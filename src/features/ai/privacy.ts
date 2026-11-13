/**
 * Enmascara datos sensibles (claves, contraseñas, tokens) antes de enviar texto a una IA externa.
 */
export function maskSensitiveContent(text: string): { maskedText: string; count: number } {
  if (!text) return { maskedText: '', count: 0 };

  let count = 0;
  const hit = (label: string) => () => {
    count++;
    return label;
  };

  let masked = text;
  masked = masked.replace(/hf_[a-zA-Z0-9]{25,}/g, hit('[PROTEGIDO:HF_KEY]'));
  masked = masked.replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, hit('[PROTEGIDO:CLAUDE_KEY]'));
  masked = masked.replace(/sk-[a-zA-Z0-9]{20,}/g, hit('[PROTEGIDO:API_KEY]'));
  masked = masked.replace(/gh[pousr]_[a-zA-Z0-9]{30,}/g, hit('[PROTEGIDO:GITHUB_TOKEN]'));
  masked = masked.replace(/AKIA[0-9A-Z]{16}/g, hit('[PROTEGIDO:AWS_KEY]'));
  masked = masked.replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, hit('[PROTEGIDO:JWT]'));
  masked = masked.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, hit('[PROTEGIDO:LLAVE_PRIVADA]'));
  masked = masked.replace(/Bearer\s+[a-zA-Z0-9_\-.]{20,}/gi, hit('Bearer [PROTEGIDO:BEARER_TOKEN]'));
  masked = masked.replace(
    /(password|passwd|clave|contraseña|secret|token|api_key)\s*[:=]\s*([^\s,;]+)/gi,
    (_m, key) => {
      count++;
      return `${key}: [PROTEGIDO:SECRETO]`;
    }
  );

  return { maskedText: masked, count };
}
