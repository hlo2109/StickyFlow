/**
 * Lectura de archivos para usarlos como contexto (tu CV, documentos de proyectos, notas, correos…).
 *
 * Soporta texto plano (.txt .md .csv .json .log .yml .xml), HTML y Word (.docx, sin librerías externas).
 * No soporta PDF ni .doc antiguo: se avisa cómo pasarlos (copiar y pegar, o guardar como .txt / .docx).
 */

/** Tamaño máximo de un archivo. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const PLAIN_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'yml', 'yaml', 'xml', 'ini', 'tex'];
const HTML_EXT = ['html', 'htm'];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

/** Texto visible de un HTML: sin scripts, estilos ni etiquetas. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n') // sin espacios sueltos pegados a los saltos de línea
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ------------------------------------------------------------------ Word (.docx)

/**
 * Un .docx es un ZIP con `word/document.xml`. Se lee el ZIP a mano (directorio central → entrada → desinflar)
 * y se extrae el texto de los párrafos. Así no hace falta ninguna librería.
 */
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // 1) Fin del directorio central (EOCD): firma 0x06054b50, buscándola desde el final
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('El archivo no parece un documento de Word válido.');

  const entries = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true); // inicio del directorio central

  // 2) Recorrer el directorio central hasta encontrar word/document.xml
  for (let n = 0; n < entries; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nameLen));

    if (name === 'word/document.xml') {
      // 3) Cabecera local: tiene su propio largo de nombre y extras
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = data.subarray(start, start + compSize);

      let xmlBytes: Uint8Array;
      if (method === 0) {
        xmlBytes = raw;
      } else if (method === 8) {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error('Este documento de Word usa un formato de compresión no compatible.');
      }
      return wordXmlToText(new TextDecoder('utf-8').decode(xmlBytes));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('No se encontró el contenido del documento de Word.');
}

/** Extrae el texto de `document.xml`: un salto de línea por párrafo, respetando tabulaciones y saltos. */
export function wordXmlToText(xml: string): string {
  const decode = (s: string) =>
    s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  const lines = paragraphs.map((para) => {
    let line = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(para))) {
      if (m[1] !== undefined) line += decode(m[1]);
      else if (m[0].startsWith('<w:tab')) line += '\t';
      else line += '\n';
    }
    return line;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ------------------------------------------------------------------ API para la interfaz

export type FileTextResult = { title: string; text: string } | { error: string };

export async function readContextFile(file: File): Promise<FileTextResult> {
  const ext = extensionOf(file.name);
  const title = file.name.replace(/\.[^.]+$/, '');

  if (file.size > MAX_FILE_BYTES) {
    return { error: `«${file.name}» pesa más de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB. Usa una versión más corta o copia solo lo importante.` };
  }

  try {
    if (PLAIN_EXT.includes(ext)) return { title, text: (await file.text()).trim() };
    if (HTML_EXT.includes(ext)) return { title, text: htmlToText(await file.text()) };
    if (ext === 'docx') return { title, text: await extractDocxText(await file.arrayBuffer()) };

    if (ext === 'pdf') {
      return {
        error: `Los PDF todavía no se pueden leer directo. Abre «${file.name}», copia el texto y pégalo aquí (botón «Pegar texto»), o guárdalo como .txt o .docx.`
      };
    }
    if (ext === 'doc' || ext === 'xls' || ext === 'xlsx' || ext === 'ppt' || ext === 'pptx') {
      return { error: `El formato .${ext} no es compatible. Guarda el documento como .docx o .txt, o copia y pega el texto.` };
    }
    return { error: `No sé leer archivos .${ext || 'sin extensión'}. Usa .txt, .md, .docx, .csv, .json o .html, o pega el texto.` };
  } catch (err: any) {
    return { error: `No se pudo leer «${file.name}»: ${err?.message || 'error desconocido'}.` };
  }
}
