import { getPresupuestos, getPatrimonio } from '../lib/api.js';
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
    const [items, patr] = await Promise.all([
      getPresupuestos(mes),
      // Un fallo aquí no debe romper la pantalla; solo se omite el resumen.
      getPatrimonio().catch(() => null),
    ]);

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

    // Resumen: saldo líquido, total presupuestado y lo que queda libre para
    // dirigir (a ahorro/inversión) si se cubre todo el presupuesto sin imprevistos.
    const saldoLiquido = patr == null ? null : Number(patr.saldo_liquido ?? 0);
    const libre = saldoLiquido == null ? null : saldoLiquido - totalPres;
    const resumen = `
      <p class="section-label" style="margin-top:0">Resumen del mes</p>
      <div class="panel">
        ${
          saldoLiquido == null
            ? ''
            : `<div class="row">
                 <span class="r-label">Saldo líquido (a la mano)</span>
                 <span class="r-value tnum">${money(saldoLiquido)}</span>
               </div>`
        }
        <div class="row">
          <span class="r-label">Total presupuestado</span>
          <span class="r-value tnum">${money(totalPres)}</span>
        </div>
        ${
          libre == null
            ? ''
            : `<div class="row total">
                 <span class="r-label">${
                   libre >= 0 ? 'Libre para dirigir' : 'Falta para cubrir'
                 }</span>
                 <span class="r-value tnum ${
                   libre >= 0 ? 'c-verde' : 'c-rojo'
                 }">${money(Math.abs(libre))}</span>
               </div>`
        }
      </div>
      ${
        libre == null
          ? ''
          : `<p class="resumen-note">${
              libre >= 0
                ? 'Es tu saldo líquido menos todo lo presupuestado. Si no surge un imprevisto, esto queda libre para dirigirlo (ahorro, inversión…).'
                : 'Lo presupuestado supera tu saldo líquido: te falta esta cantidad para cubrir todo el presupuesto del mes.'
            }</p>`
      }`;

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
      ${resumen}
      <p class="section-label">Por categoría</p>
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
