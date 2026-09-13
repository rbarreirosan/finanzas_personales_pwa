import { getPresupuestos } from '../lib/api.js';
import { money, pct, currentMonth, monthLabel } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Presupuestos del mes desde la vista v_presupuestos (ya trae gastado,
// disponible, pct_consumido y semaforo calculados).
export function PresupuestosView() {
  const el = document.createElement('div');
  const mes = currentMonth();
  el.innerHTML = `
    <p class="section-title">Presupuestos · ${escapeHtml(monthLabel(mes))}</p>
    <div id="pres-content"><div class="loading">Cargando presupuestos…</div></div>
  `;
  load(el.querySelector('#pres-content'), mes);
  return el;
}

async function load(container, mes) {
  try {
    const items = await getPresupuestos(mes);
    if (!items.length) {
      container.innerHTML =
        '<div class="empty">No hay presupuestos definidos para este mes.</div>';
      return;
    }

    container.innerHTML = items
      .map((p) => {
        const consumido = Math.min(100, Number(p.pct_consumido ?? 0));
        const sem = `sem-${p.semaforo || 'verde'}`;
        return `
          <div class="budget">
            <div class="top">
              <span class="name"><span class="dot ${sem}"></span>${escapeHtml(
          p.categoria_nombre
        )}</span>
              <span class="hint">${pct(p.pct_consumido)}</span>
            </div>
            <div class="bar ${sem}"><span style="width:${consumido}%"></span></div>
            <div class="row" style="border:none;padding-top:8px">
              <span class="hint">Gastado ${money(p.monto_gastado)} / ${money(
          p.monto_presupuestado
        )}</span>
              <span class="hint">Disponible ${money(p.disponible)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<div class="msg error">No se pudieron cargar los presupuestos: ${escapeHtml(
      err.message || err
    )}</div>`;
  }
}
