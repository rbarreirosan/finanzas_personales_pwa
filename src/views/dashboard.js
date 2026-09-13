import {
  getDisponibleReal,
  getKpisMes,
  getPatrimonio,
  getColchonMeses,
  getMovimientos,
} from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { money, pct, currentMonth, monthLabel } from '../lib/format.js';
import { isPrivate, togglePrivate } from '../lib/privacy.js';
import { escapeHtml } from '../lib/dom.js';
import { movItemHtml } from './movimientos.js';

const RECIENTES = 5; // cuántos movimientos mostrar en el resumen del inicio

const EYE =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.7"/><path d="M6.6 6.6A13 13 0 0 0 2 13s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"/></svg>';

// Dashboard: cabecera de vidrio + KPI principal "Disponible real" + este mes,
// patrimonio y colchón financiero. Incluye botón para ocultar cantidades.
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
        <div style="display:flex;gap:8px;align-items:center">
          <button class="icon-btn" id="toggle-privacy" aria-label="Ocultar o mostrar cantidades">${
            isPrivate() ? EYE_OFF : EYE
          }</button>
          <a class="icon-btn" href="#/ajustes" aria-label="Ajustes">⚙️</a>
        </div>
      </div>
    </header>
    <div class="screen-body" id="dash-content">
      <div class="loading">Cargando KPIs…</div>
    </div>
  `;

  const container = el.querySelector('#dash-content');
  let lastData = null;

  setGreeting(el.querySelector('#greeting'), mes);
  load(container, mes).then((d) => {
    lastData = d;
  });

  el.querySelector('#toggle-privacy').addEventListener('click', () => {
    const now = togglePrivate();
    el.querySelector('#toggle-privacy').innerHTML = now ? EYE_OFF : EYE;
    if (lastData) render(container, lastData);
  });

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
    const [disp, kpis, patr, colchon, movs] = await Promise.all([
      getDisponibleReal(mes),
      getKpisMes(mes),
      getPatrimonio(),
      getColchonMeses(),
      // Un fallo aquí no debe romper el Dashboard.
      getMovimientos().catch(() => []),
    ]);
    const data = { disp, kpis, patr, colchon, movs };
    render(container, data);
    return data;
  } catch (err) {
    container.innerHTML = `<div class="msg error">No se pudieron cargar los KPIs: ${escapeHtml(
      err.message || err
    )}</div>`;
    return null;
  }
}

function render(container, { disp, kpis, patr, colchon, movs = [] }) {
  const dispReal = Number(disp?.disponible_real ?? 0);
  const flujo = Number(kpis?.flujo_neto ?? 0);
  const deuda = Number(patr?.deuda_credito ?? 0);
  const neto = Number(patr?.patrimonio_neto ?? 0);
  const col = colchon == null ? null : Number(colchon);
  const colSem =
    col == null ? 'verde' : col >= 6 ? 'verde' : col >= 3 ? 'amarillo' : 'rojo';

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
        <span class="k-value tnum c-white">${
          isPrivate() ? '' : flujo >= 0 ? '+' : ''
        }${money(flujo)}</span>
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
        <span class="r-value tnum c-rojo">${
          isPrivate() ? '' : deuda > 0 ? '−' : ''
        }${money(deuda)}</span>
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

    <a class="mov-section" href="#/movimientos">
      <div class="mov-head">
        <span class="section-label" style="margin:0">Movimientos recientes</span>
        <span class="chev">›</span>
      </div>
      ${
        movs.length
          ? `<div class="mov-list">${movs.slice(0, RECIENTES).map(movItemHtml).join('')}</div>
             <div class="mov-more">Ver todos los movimientos ›</div>`
          : '<div class="empty-mini">Aún no hay movimientos. Toca “Nuevo” para registrar uno.</div>'
      }
    </a>
  `;
}
