/**
 * secureSettings
 * --------------
 * Manejo seguro de los secretos de la configuración (API keys y tokens).
 *
 *  - En disco (settings.json) los secretos se guardan CIFRADOS con safeStorage de Electron,
 *    que usa DPAPI en Windows: solo se pueden descifrar con tu usuario de Windows en este equipo.
 *  - En respaldos y exportaciones NUNCA se incluyen (esas copias suelen terminar en la nube).
 *  - Si safeStorage no está disponible, se guardan vacíos en lugar de en texto plano.
 */

const { safeStorage } = require('electron');
const fs = require('fs');

/** Campos de AppSettings que contienen credenciales. */
const SECRET_FIELDS = ['hfApiKey', 'claudeApiKey', 'cloudflareApiToken', 'remoteDbApiKey', 'deepgramApiKey', 'elevenLabsApiKey'];

const PREFIX = 'enc:v1:';

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptValue(value) {
  if (typeof value !== 'string' || value === '') return '';
  if (value.startsWith(PREFIX)) return value; // ya cifrado
  if (!canEncrypt()) return ''; // mejor perder la clave que guardarla en claro
  return PREFIX + safeStorage.encryptString(value).toString('base64');
}

function decryptValue(value) {
  if (typeof value !== 'string' || value === '') return '';
  if (!value.startsWith(PREFIX)) return value; // formato antiguo en texto plano: se migra al guardar
  if (!canEncrypt()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value.slice(PREFIX.length), 'base64'));
  } catch {
    return ''; // cifrado con otro usuario/equipo
  }
}

function mapSecrets(settings, fn) {
  const out = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (field in out) out[field] = fn(out[field]);
  }
  return out;
}

/** Devuelve una copia con los secretos descifrados (para usar en memoria). */
function decryptSettings(settings) {
  return mapSecrets(settings || {}, decryptValue);
}

/** Devuelve una copia con los secretos cifrados (para escribir en disco). */
function encryptSettings(settings) {
  return mapSecrets(settings || {}, encryptValue);
}

/** Devuelve una copia SIN secretos (para respaldos, exportaciones y logs). */
function stripSecrets(settings) {
  return mapSecrets(settings || {}, () => '');
}

/**
 * Al restaurar un respaldo, conserva los secretos actuales: lo que venga del respaldo
 * nunca debe sobrescribir tus claves.
 */
function mergeKeepingSecrets(current, incoming) {
  const merged = { ...current, ...incoming };
  for (const field of SECRET_FIELDS) {
    merged[field] = (current || {})[field] || '';
  }
  return merged;
}

/** Lee settings.json y descifra los secretos. Devuelve null si no existe o está dañado. */
function readSettingsFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return decryptSettings(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch (err) {
    console.error('Error leyendo settings:', err.message);
    return null;
  }
}

/** Cifra los secretos y escribe settings.json. */
function writeSettingsFile(filePath, settings) {
  fs.writeFileSync(filePath, JSON.stringify(encryptSettings(settings), null, 2), 'utf-8');
}

module.exports = {
  SECRET_FIELDS,
  decryptSettings,
  encryptSettings,
  stripSecrets,
  mergeKeepingSecrets,
  readSettingsFile,
  writeSettingsFile
};
