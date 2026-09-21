import { listMetas, listMetaItems } from '../lib/api.js';
import { totalMeta, invertidoMeta, pctMeta } from '../lib/metasCalc.js';
import { money0 } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Lista de metas en tarjetas de 2 columnas + estado vacío.
export function MetasView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div>
          <h1 class="large-title">Metas</h1>
          <div class="subtitle" id="metas-sub">Tus objetivos de compra</div>
        </div>
        <a class="icon-btn" href="#/meta-form" aria-label="Nueva meta">+</a>
      </div>
    </header>
    <div class="screen-body" id="metas-body">
      <div class="loading">Cargando metas…</div>
    </div>
  `;
  init(el).catch((err) => {
    el.querySelector('#metas-body').innerHTML = `<div class="msg error">No se pudieron cargar las metas: ${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el) {
  const body = el.querySelector('#metas-body');
  const sub = el.querySelector('#metas-sub');

  const [metas, items] = await Promise.all([listMetas(), listMetaItems()]);
  const activas = metas.filter((m) => m.activa);

  const itemsByMeta = {};
  for (const it of items) (itemsByMeta[it.meta_id] ||= []).push(it);

  if (!activas.length) {
    sub.textContent = 'Aún no tienes metas';
    body.innerHTML = emptyHtml();
    return;
  }

  let invAll = 0;
  let totAll = 0;
  const cards = activas
    .map((m) => {
      const its = itemsByMeta[m.id] || [];
      const t = totalMeta(its);
      const inv = invertidoMeta(its);
      const p = pctMeta(its);
      invAll += inv;
      totAll += t;
      const completa = p >= 100;
      const fill = completa
        ? '<div class="meta-fill done" style="width:100%"></div>'
        : `<div class="meta-fill" style="width:${Math.max(3, p)}%"></div>`;
      return `
        <a class="meta-card" href="#/meta-detalle?id=${m.id}">
          <div class="mc-top">
            <span class="mc-emoji">${escapeHtml(m.emoji || '🎯')}</span>
            <span class="mc-pct ${completa ? 'done' : ''}">${p}%</span>
          </div>
          <div class="mc-name">${escapeHtml(m.nombre)}</div>
          <div>
            <div class="meta-track">${fill}</div>
            <div class="mc-nums"><b>${money0(inv)}</b> / ${money0(t)}</div>
          </div>
        </a>`;
    })
    .join('');

  const plural = activas.length === 1 ? 'activa' : 'activas';
  sub.textContent = `${activas.length} ${plural} · ${money0(invAll)} de ${money0(
    totAll
  )}`;

  body.innerHTML = `
    <p class="section-label" style="margin-top:4px">Metas activas</p>
    <div class="metas-grid">
      ${cards}
      <a class="meta-card-new" href="#/meta-form">
        <span class="mcn-plus">+</span>
        <span>Nueva meta</span>
      </a>
    </div>
    <p class="resumen-note" style="margin-top:16px">
      Lo invertido se calcula solo: es la suma de los ítems que marcas como comprados.
    </p>
  `;
}

function emptyHtml() {
  return `
    <div class="metas-empty">
      <div class="me-badge">
        <div class="me-ring"><div class="me-dot"></div></div>
      </div>
      <div class="me-title">Aún no tienes metas</div>
      <div class="me-sub">Arma una lista de lo que quieres comprar y ve avanzando conforme lo consigues.</div>
      <a class="btn btn-block meta-btn" href="#/meta-form" style="margin-top:24px;text-decoration:none;display:flex;align-items:center;justify-content:center">
        Crear mi primera meta
      </a>
    </div>
  `;
}
