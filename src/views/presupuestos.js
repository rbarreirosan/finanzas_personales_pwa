import { getPresupuestos, getPatrimonio } from '../lib/api.js';
import {
  money,
  pct,
  currentMonth,
  monthLabel,
  daysLeftInMonth,
} from '../lib/format.js';
import { getObjetivo } from '../lib/objetivo.js';
import { escapeHtml } from '../lib/dom.js';

// Tarjeta hero con degradado dinámico verde→rojo según qué tan cerca está lo
// "libre para dirigir" del objetivo del mes (verde = objetivo cubierto).
//
// Clave: se resta lo que AÚN FALTA por gastar del presupuesto (pendiente), no
// el presupuesto completo. Así, gastar dentro de lo presupuestado no altera el
// resultado: el saldo baja, pero el pendiente baja igual. Solo cambia si te
// pasas de lo presupuestado (pendiente ya no baja) o si entra/sale dinero.
function gaugeCard(saldoLiquido, totalPres, pendiente, objetivo) {
  // Sin patrimonio: tarjeta neutra, sin medidor.
  if (saldoLiquido == null) {
    return `
      <div class="hero gauge gauge-neutral">
        <span class="label">Presupuestado del mes</span>
        <span class="amount tnum">${money(totalPres)}</span>
      </div>`;
  }
  const libre = saldoLiquido - pendiente;
  const meta = objetivo > 0 ? objetivo : 1;
  const p = Math.max(0, Math.min(1, libre / meta)) * 100; // % de verde
  // Objetivo cubierto: todo verde. $0 o menos: todo rojo. En medio: degradado
  // con el punto verde/rojo en el porcentaje correspondiente.
  let bg;
  if (p >= 100) bg = '#16a34a';
  else if (p <= 0) bg = '#dc2626';
  else {
    const g1 = Math.max(0, p - 15);
    const g2 = Math.min(100, p + 15);
    bg = `linear-gradient(90deg, #16a34a 0%, #16a34a ${g1}%, #dc2626 ${g2}%, #dc2626 100%)`;
  }
  const label =
    libre >= 0 ? '⚖️ Libre para dirigir' : '⚠️ Te falta para cubrir';

  return `
    <div class="hero gauge" style="background:${bg}">
      <div class="gauge-top">
        <span class="label">${label}</span>
        <span class="gauge-pct">${Math.round(p)}% de ${money(objetivo)}</span>
      </div>
      <span class="amount tnum">${money(Math.abs(libre))}</span>
      <div class="divider"></div>
      <span class="breakdown tnum">Saldo líquido ${money(
        saldoLiquido
      )} · Falta por gastar ${money(pendiente)}</span>
    </div>`;
}

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
    // Pendiente por gastar: por categoría, lo que falta del presupuesto sin
    // dejar que un sobregasto en una categoría reste a otra (piso en 0).
    const totalPendiente = items.reduce(
      (a, p) =>
        a +
        Math.max(
          0,
          Number(p.monto_presupuestado || 0) - Number(p.monto_gastado || 0)
        ),
      0
    );
    sub.textContent = `${monthLabel(mes)} · ${money(totalGastado)} de ${money(
      totalPres
    )}`;

    // Resumen: tarjeta con medidor dinámico (verde→rojo) de lo "libre para
    // dirigir" respecto al objetivo del mes (ajustable en Ajustes).
    const saldoLiquido = patr == null ? null : Number(patr.saldo_liquido ?? 0);
    const objetivo = getObjetivo(mes);
    const libre = saldoLiquido == null ? null : saldoLiquido - totalPendiente;
    const resumen = `
      <p class="section-label" style="margin-top:0">Resumen del mes</p>
      ${gaugeCard(saldoLiquido, totalPres, totalPendiente, objetivo)}
      ${
        libre == null
          ? ''
          : `<p class="resumen-note">${
              libre >= 0
                ? `Es tu saldo líquido menos lo que aún falta gastar del presupuesto; por eso no cambia si gastas dentro de lo planeado. El medidor se llena de verde conforme te acercas a tu objetivo de ${money(
                    objetivo
                  )} libres para dirigir (ahorro, inversión…).`
                : 'Tu saldo líquido no alcanza a cubrir lo que aún falta gastar del presupuesto: te falta esta cantidad.'
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
