import { getPresupuestos } from '../lib/api.js';
import {
  money0,
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
        <div class="icon-btn" aria-hidden="true">+</div>
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
      container.innerHTML =
        '<div class="empty">No hay presupuestos definidos para este mes.</div>';
      return;
    }

    const totalGastado = items.reduce((a, p) => a + Number(p.monto_gastado || 0), 0);
    const totalPres = items.reduce(
      (a, p) => a + Number(p.monto_presupuestado || 0),
      0
    );
    sub.textContent = `${monthLabel(mes)} · ${money0(totalGastado)} de ${money0(
      totalPres
    )}`;

    const cards = items
      .map((p) => {
        const consumido = Math.min(100, Number(p.pct_consumido ?? 0));
        const sem = `sem-${p.semaforo || 'verde'}`;
        const disp = Number(p.disponible ?? 0);
        const foot =
          disp < 0
            ? `<span class="b-foot over tnum">Gastado ${money0(
                p.monto_gastado
              )} / ${money0(p.monto_presupuestado)} · Excedido ${money0(
                Math.abs(disp)
              )}</span>`
            : `<span class="b-foot tnum">Gastado ${money0(
                p.monto_gastado
              )} / ${money0(p.monto_presupuestado)} · Disponible ${money0(
                disp
              )}</span>`;

        return `
          <div class="budget ${sem}">
            <div class="b-head">
              <span class="b-name"><span class="dot ${sem}"></span>${escapeHtml(
          p.categoria_nombre
        )}</span>
              <span class="b-pct ${sem} tnum">${pct(p.pct_consumido)}</span>
            </div>
            <div class="bar ${sem}"><span style="width:${consumido}%"></span></div>
            ${foot}
          </div>
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
