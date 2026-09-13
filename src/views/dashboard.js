import {
  getDisponibleReal,
  getKpisMes,
  getPatrimonio,
  getColchonMeses,
} from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { money, pct, currentMonth, monthLabel } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Dashboard: cabecera de vidrio + KPI principal "Disponible real" + este mes,
// patrimonio y colchón financiero.
export function DashboardView() {
  const el = document.createElement('div');
  el.className = 'screen';
  const mes = currentMonth();

  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div>
          <h1 class="large-title">Dashboard</h1>
          <div class="subtitle" id="greeting">${escapeHtml(monthLabel(mes))}</div>
        </div>
        <a class="icon-btn" href="#/ajustes" aria-label="Ajustes">⚙️</a>
      </div>
    </header>
    <div class="screen-body" id="dash-content">
      <div class="loading">Cargando KPIs…</div>
    </div>
  `;

  setGreeting(el.querySelector('#greeting'), mes);
  load(el.querySelector('#dash-content'), mes);
  return el;
}

async function setGreeting(node, mes) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const name = user?.email ? user.email.split('@')[0] : null;
    const nice = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
    node.textContent = `${nice ? `Hola, ${nice} · ` : ''}${monthLabel(mes)}`;
  } catch {
    /* deja el mes */
  }
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
    const deuda = Number(patr?.deuda_credito ?? 0);
    const neto = Number(patr?.patrimonio_neto ?? 0);
    const col = colchon == null ? null : Number(colchon);
    const colSem = col == null ? 'verde' : col >= 6 ? 'verde' : col >= 3 ? 'amarillo' : 'rojo';

    container.innerHTML = `
      <div class="hero">
        <span class="label">⭐ Disponible real para gastar</span>
        <span class="amount tnum">${money(dispReal)}</span>
        <div class="divider"></div>
        <span class="breakdown tnum">
          Líquido ${money(disp?.saldo_liquido)} · Esencial restante
          ${money(disp?.presupuesto_esencial_restante)} · Ahorro pendiente
          ${money(disp?.ahorro_meta_pendiente)}
        </span>
      </div>

      <p class="section-label">Este mes</p>
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="k-label">Ingresos</span>
          <span class="k-value tnum c-verde">${money(kpis?.ingresos_mes)}</span>
        </div>
        <div class="kpi-card">
          <span class="k-label">Gastos</span>
          <span class="k-value tnum c-rojo">${money(kpis?.gastos_mes)}</span>
        </div>
        <div class="kpi-card">
          <span class="k-label">Flujo neto</span>
          <span class="k-value tnum c-white">${flujo >= 0 ? '+' : ''}${money(
      flujo
    )}</span>
        </div>
        <div class="kpi-card">
          <span class="k-label">Tasa de ahorro</span>
          <span class="k-value tnum c-indigo">${pct(kpis?.tasa_ahorro)}</span>
        </div>
      </div>

      <p class="section-label">Patrimonio</p>
      <div class="panel">
        <div class="row">
          <span class="r-label">Saldo líquido</span>
          <span class="r-value tnum">${money(patr?.saldo_liquido)}</span>
        </div>
        <div class="row">
          <span class="r-label">Ahorro e inversión</span>
          <span class="r-value tnum">${money(patr?.ahorro_inversion)}</span>
        </div>
        <div class="row">
          <span class="r-label">Deuda de crédito</span>
          <span class="r-value tnum c-rojo">${deuda > 0 ? '−' : ''}${money(
      deuda
    )}</span>
        </div>
        <div class="row total">
          <span class="r-label">Patrimonio neto</span>
          <span class="r-value tnum ${neto >= 0 ? 'c-verde' : 'c-rojo'}">${money(
      neto
    )}</span>
        </div>
      </div>

      <div class="glass-row">
        <div class="badge sem-${colSem}">
          <span class="b-num tnum">${col == null ? '—' : col.toFixed(1)}</span>
          <span class="b-unit">MESES</span>
        </div>
        <div>
          <div class="gr-title">Colchón financiero</div>
          <div class="gr-sub">Meta recomendada: 6 meses de gastos esenciales.</div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="msg error">No se pudieron cargar los KPIs: ${escapeHtml(
      err.message || err
    )}</div>`;
  }
}
