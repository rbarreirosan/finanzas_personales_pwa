// Estado de "ocultar cantidades" (modo privacidad), recordado por dispositivo.
const KEY = 'fp_privacy';

export function isPrivate() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPrivate(v) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* almacenamiento no disponible: se queda en memoria de esta sesión */
  }
}

export function togglePrivate() {
  const next = !isPrivate();
  setPrivate(next);
  return next;
}
