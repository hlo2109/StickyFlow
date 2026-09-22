import TurndownService from 'turndown';
import { marked } from 'marked';
import { Note } from '../types';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

// Configure task list item rule in Turndown
turndownService.addRule('taskListItem', {
  filter: (node) => {
    return (
      node.nodeName === 'LI' &&
      node.getAttribute('data-type') === 'taskItem'
    );
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const checked = el.getAttribute('data-checked') === 'true';
    const text = el.textContent || '';
    return `${checked ? '- [x] ' : '- [ ] '}${text.trim()}\n`;
  }
});

// Rule for TipTap images
turndownService.addRule('imageItem', {
  filter: 'img',
  replacement: (_content, node) => {
    const el = node as HTMLImageElement;
    const alt = el.getAttribute('alt') || 'imagen';
    const src = el.getAttribute('src') || '';
    return `![${alt}](${src})\n\n`;
  }
});

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return turndownService.turndown(html);
  } catch (err) {
    console.error('Error converting HTML to Markdown:', err);
    return html;
  }
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  try {
    return marked.parse(md, { async: false }) as string;
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
    return md;
  }
}

/**
 * Format note for Claude / LLMs with complete bitácora, metadata and structured Markdown
 */
export function formatNoteForClaude(note: Note): string {
  const bitacoraText = note.bitacora && note.bitacora.length > 0
    ? note.bitacora.map(b => `- [${b.timestamp}] (${b.action}): ${b.summary}`).join('\n')
    : 'Sin registros de bitácora previos.';

  const mdContent = note.markdownContent || htmlToMarkdown(note.content);

  return [
    `# Contexto de la Nota para Análisis por Claude`,
    `---`,
    `**Título**: ${note.title || 'Sin título'}`,
    `**ID de Nota**: ${note.id}`,
    `**Fecha de Creación**: ${new Date(note.createdAt).toLocaleString('es-ES')}`,
    `**Última Modificación**: ${new Date(note.updatedAt).toLocaleString('es-ES')}`,
    `**Color / Etiqueta**: ${note.color} | ${note.tags.join(', ') || 'General'}`,
    `**Bitácora de Actividad**:`,
    bitacoraText,
    `---`,
    `## Contenido en Formato Markdown:`,
    '',
    mdContent,
    '',
    `---`,
    `*Instrucción para Claude: Analiza la tarea, contenido o bitácora anterior según las instrucciones del usuario.*`
  ].join('\n');
}
