// Objetivo mensual de "libre para dirigir": el monto que, si queda libre tras
// cubrir todo el presupuesto, se considera 100% (barra llena de verde). Se
// guarda por mes en el dispositivo. Si un mes no tiene valor propio, usa el
// valor por defecto.
const PREFIX = 'fp_objetivo_';
export const DEFAULT_OBJETIVO = 300;

export function getObjetivo(mes) {
  try {
    const v = localStorage.getItem(PREFIX + mes);
    if (v == null) return DEFAULT_OBJETIVO;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_OBJETIVO;
  } catch {
    return DEFAULT_OBJETIVO;
  }
}

export function setObjetivo(mes, val) {
  const n = Number(val);
  try {
    if (!Number.isFinite(n) || n <= 0) localStorage.removeItem(PREFIX + mes);
    else localStorage.setItem(PREFIX + mes, String(n));
  } catch {
    /* sin almacenamiento: se queda con el valor por defecto */
  }
}
