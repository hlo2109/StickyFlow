// ¿DATA_DIR está en un volumen montado? Dentro de Docker, una carpeta de un volumen vive en un dispositivo distinto
// al del sistema de archivos del contenedor (que se borra en cada despliegue). Fuera de Docker siempre es persistente.
import fs from 'node:fs';

export function isPersistent(dataDir, fsApi = fs) {
  try {
    if (!fsApi.existsSync('/.dockerenv')) return true; // no es un contenedor
    return fsApi.statSync(dataDir).dev !== fsApi.statSync('/').dev;
  } catch {
    return true; // sin datos suficientes no se alarma
  }
}
