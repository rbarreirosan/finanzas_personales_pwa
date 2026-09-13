import { getMovimientos } from '../lib/api.js';
import { money, dayLabel } from '../lib/format.js';
import { isPrivate } from '../lib/privacy.js';
import { escapeHtml } from '../lib/dom.js';

const META = {
  ingreso: { emoji: '⬆️', cls: 'c-verde', sign: '+' },
  gasto: { emoji: '⬇️', cls: 'c-rojo', sign: '−' },
  transferencia: { emoji: '🔁', cls: '', sign: '' },
};

// HTML de una fila de movimiento. Se reutiliza en el Dashboard y en la
// pantalla completa de movimientos.
export function movItemHtml(m) {
  const meta = META[m.tipo] || META.gasto;
  const title =
    (m.comercio && m.comercio.trim()) ||
    m.categoria_nombre ||
    (m.descripcion && m.descripcion.trim()) ||
    (m.tipo === 'transferencia' ? 'Transferencia' : 'Movimiento');
  const cuentaTxt =
    m.tipo === 'transferencia'
      ? `${m.cuenta_nombre ?? '—'} → ${m.cuenta_destino_nombre ?? '—'}`
      : m.cuenta_nombre ?? '—';
  const sub = `${dayLabel(m.fecha)} · ${cuentaTxt}`;
  const sign = isPrivate() ? '' : meta.sign;

  return `
    <div class="mng-item mov-item">
      <span class="mi-emoji">${meta.emoji}</span>
      <span class="grow">
        <span class="mi-title">${escapeHtml(title)}</span>
        <span class="mi-sub">${escapeHtml(sub)}</span>
      </span>
      <span class="mi-amount tnum ${meta.cls}">${sign}${money(m.monto)}</span>
    </div>`;
}

// Pantalla completa: todos los movimientos (ingresos, gastos y transferencias).
export function MovimientosView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/dashboard" aria-label="Volver">‹</a>
          <h1 class="large-title">Movimientos</h1>
        </div>
      </div>
    </header>
    <div class="screen-body" id="body"><div class="loading">Cargando…</div></div>
  `;

  const body = el.querySelector('#body');
  getMovimientos()
    .then((movs) => render(body, movs))
    .catch((err) => {
      body.innerHTML = `<div class="msg error">No se pudieron cargar los movimientos: ${escapeHtml(
        err.message || err
      )}</div>`;
    });

  return el;
}

function render(body, movs) {
  if (!movs.length) {
    body.innerHTML =
      '<div class="empty">Aún no tienes movimientos.<br>Toca “Nuevo” abajo para registrar el primero.</div>';
    return;
  }
  body.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:8px">' +
    movs.map(movItemHtml).join('') +
    '</div>';
}
