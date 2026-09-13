import {
  getDisponibleReal,
  getKpisMes,
  getPatrimonio,
  getColchonMeses,
} from '../lib/api.js';
import { money, pct, currentMonth, monthLabel } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Dashboard: KPI principal "Disponible real" + patrimonio, mes y colchon.
export function DashboardView() {
  const el = document.createElement('div');
  const mes = currentMonth();

  el.innerHTML = `
    <p class="section-title">Resumen · ${escapeHtml(monthLabel(mes))}</p>
    <div id="dash-content"><div class="loading">Cargando KPIs…</div></div>
  `;

  load(el.querySelector('#dash-content'), mes);
  return el;
}

async function load(container, mes) {
  try {
    const [disp, kpis, patr, colchon] = await Promise.all([
      getDisponibleReal(mes),
      getKpisMes(mes),
      getPatrimonio(),
      getColchonMeses(),
    ]);

    const dispReal = Number(disp?.disponible_real ?? 0);
    const flujo = Number(kpis?.flujo_neto ?? 0);

    container.innerHTML = `
      <div class="card kpi-hero">
        <div class="label">⭐ Disponible real para gastar</div>
        <div class="value">${money(dispReal)}</div>
        <div class="sub">
          Líquido ${money(disp?.saldo_liquido)} · Esencial restante
          ${money(disp?.presupuesto_esencial_restante)} · Ahorro pendiente
          ${money(disp?.ahorro_meta_pendiente)}
        </div>
      </div>

      <p class="section-title">Este mes</p>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="label">Ingresos</div>
          <div class="value pos">${money(kpis?.ingresos_mes)}</div>
        </div>
        <div class="kpi">
          <div class="label">Gastos</div>
          <div class="value neg">${money(kpis?.gastos_mes)}</div>
        </div>
        <div class="kpi">
          <div class="label">Flujo neto</div>
          <div class="value ${flujo >= 0 ? 'pos' : 'neg'}">${money(flujo)}</div>
        </div>
        <div class="kpi">
          <div class="label">Tasa de ahorro</div>
          <div class="value">${pct(kpis?.tasa_ahorro)}</div>
        </div>
      </div>

      <p class="section-title">Patrimonio</p>
      <div class="card">
        <div class="row"><span>Saldo líquido</span><strong>${money(
          patr?.saldo_liquido
        )}</strong></div>
        <div class="row"><span>Ahorro e inversión</span><strong>${money(
          patr?.ahorro_inversion
        )}</strong></div>
        <div class="row"><span>Deuda de crédito</span><strong>${money(
          patr?.deuda_credito
        )}</strong></div>
        <div class="row"><span>Patrimonio neto</span><strong>${money(
          patr?.patrimonio_neto
        )}</strong></div>
      </div>

      <div class="card">
        <div class="row">
          <span>Colchón financiero</span>
          <strong>${
            colchon == null ? '—' : `${Number(colchon).toFixed(1)} meses`
          }</strong>
        </div>
        <p class="hint">Meses que cubres con tu saldo líquido al ritmo de gasto reciente.</p>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="msg error">No se pudieron cargar los KPIs: ${escapeHtml(
      err.message || err
    )}</div>`;
  }
}
