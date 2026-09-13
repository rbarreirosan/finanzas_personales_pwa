// Formateo de moneda (MXN por defecto, segun el esquema) y utilidades de fecha.
const currencyFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

const currencyFmt0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return currencyFmt.format(v);
}

// Sin decimales, para cifras "de un vistazo" (KPIs, patrimonio, presupuestos).
export function money0(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return currencyFmt0.format(v);
}

// Días que faltan para terminar el mes actual (incluye hoy).
export function daysLeftInMonth() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate();
}

export function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(0)}%`;
}

// 'YYYY-MM' del mes actual (mes analizado por defecto).
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' de hoy para inputs date.
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function monthLabel(mes) {
  // mes = 'YYYY-MM'
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}
