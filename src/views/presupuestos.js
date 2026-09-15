import { getPresupuestos } from '../lib/api.js';
import {
  money,
  pct,
  currentMonth,
  monthLabel,
  daysLeftInMonth,
} from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Presupuestos del mes desde la vista v_presupuestos (gastado, disponible,
// pct_consumido y semáforo ya calculados).
export function PresupuestosView() {
  const el = document.createElement('div');
  el.className = 'screen';
  const mes = currentMonth();

  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div>
          <h1 class="large-title">Presupuestos</h1>
          <div class="subtitle" id="pres-sub">${escapeHtml(monthLabel(mes))}</div>
        </div>
        <a class="icon-btn" href="#/presupuesto" aria-label="Nuevo presupuesto">+</a>
      </div>
    </header>
    <div class="screen-body" id="pres-content">
      <div class="loading">Cargando presupuestos…</div>
    </div>
  `;

  load(el.querySelector('#pres-content'), el.querySelector('#pres-sub'), mes);
  return el;
}

async function load(container, sub, mes) {
  try {
    const items = await getPresupuestos(mes);

    if (!items.length) {
      container.innerHTML = `
        <div class="empty">No hay presupuestos definidos para este mes.</div>
        <a class="btn btn-block" href="#/presupuesto" style="text-decoration:none;display:flex;align-items:center;justify-content:center">
          + Crear presupuesto
        </a>`;
      return;
    }

    const totalGastado = items.reduce((a, p) => a + Number(p.monto_gastado || 0), 0);
    const totalPres = items.reduce(
      (a, p) => a + Number(p.monto_presupuestado || 0),
      0
    );
    sub.textContent = `${monthLabel(mes)} · ${money(totalGastado)} de ${money(
      totalPres
    )}`;

    const cards = items
      .map((p) => {
        const consumido = Math.min(100, Number(p.pct_consumido ?? 0));
        const sem = `sem-${p.semaforo || 'verde'}`;
        const disp = Number(p.disponible ?? 0);
        const foot = `
          <div class="b-foot">
            <span class="tnum">Gastado <b>${money(p.monto_gastado)}</b> de <b>${money(
          p.monto_presupuestado
        )}</b></span>
            ${
              disp < 0
                ? `<span class="b-over tnum">Excedido ${money(Math.abs(disp))}</span>`
                : `<span class="b-disp tnum">Disponible ${money(disp)}</span>`
            }
          </div>`;

        return `
          <a class="budget ${sem}" href="#/presupuesto?cat=${p.categoria_id}&mes=${p.mes}">
            <div class="b-head">
              <span class="b-name"><span class="dot ${sem}"></span>${escapeHtml(
          p.categoria_nombre
        )}</span>
              <span class="b-pct ${sem} tnum">${pct(p.pct_consumido)}</span>
            </div>
            <div class="progress ${sem}"><span style="width:${consumido}%"></span></div>
            ${foot}
          </a>
        `;
      })
      .join('');

    container.innerHTML = `
      ${cards}
      <div class="glass-row space">
        <span style="font-size:13px;color:var(--t-70)">Quedan ${daysLeftInMonth()} días del mes</span>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="msg error">No se pudieron cargar los presupuestos: ${escapeHtml(
      err.message || err
    )}</div>`;
  }
}
