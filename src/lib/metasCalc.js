// Cálculos de metas (puros, sin acceso a datos). "Invertido", total y % nunca
// se guardan: se derivan de los ítems.
//
// Total de la meta   = suma de todos los ítems (precio_real si ya se compró,
//                      si no el precio_estimado).
// Invertido          = suma de los ítems comprados (precio_real si existe,
//                      si no el precio_estimado).

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Monto de un ítem para el TOTAL de la meta.
export function montoItem(item) {
  if (item.comprado && item.precio_real != null) return num(item.precio_real);
  return num(item.precio_estimado);
}

// Monto de un ítem para lo INVERTIDO (0 si no está comprado).
export function invertidoItem(item) {
  if (!item.comprado) return 0;
  return item.precio_real != null ? num(item.precio_real) : num(item.precio_estimado);
}

export function totalMeta(items) {
  return (items || []).reduce((a, it) => a + montoItem(it), 0);
}

export function invertidoMeta(items) {
  return (items || []).reduce((a, it) => a + invertidoItem(it), 0);
}

export function pctMeta(items) {
  const t = totalMeta(items);
  return t > 0 ? Math.round((invertidoMeta(items) / t) * 100) : 0;
}

// Meses que faltan hasta la fecha objetivo (mínimo 1). null si no hay fecha.
export function mesesRestantes(fechaObjetivo, hoy = new Date()) {
  if (!fechaObjetivo) return null;
  const f = new Date(String(fechaObjetivo).slice(0, 10) + 'T00:00:00');
  if (isNaN(f)) return null;
  const ms = f - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(1, Math.round(ms / 2629800000)); // ~1 mes en ms
}

// Cuánto conviene apartar al mes para llegar a la fecha objetivo.
// null si no hay fecha o ya no falta nada.
export function apartarMensual(items, fechaObjetivo, hoy = new Date()) {
  const meses = mesesRestantes(fechaObjetivo, hoy);
  if (!meses) return null;
  const falta = Math.max(0, totalMeta(items) - invertidoMeta(items));
  if (falta <= 0) return 0;
  return falta / meses;
}
