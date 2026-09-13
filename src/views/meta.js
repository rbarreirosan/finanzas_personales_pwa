import { getConfiguracion, guardarConfiguracion } from '../lib/api.js';
import { money } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Meta de ahorro mensual (tabla configuracion). Alimenta fn_disponible_real.
export function MetaView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/ajustes" aria-label="Volver">‹</a>
          <h1 class="large-title">Meta de ahorro</h1>
        </div>
      </div>
    </header>
    <div class="screen-body"><div class="loading">Cargando…</div></div>
  `;
  init(el).catch((err) => {
    el.querySelector('.screen-body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el) {
  const body = el.querySelector('.screen-body');
  const cfg = await getConfiguracion();
  const actual = Number(cfg?.meta_ahorro_mensual ?? 0);

  body.innerHTML = `
    <div id="msg"></div>
    <div class="card">
      <div class="field">
        <span class="f-label">¿Cuánto quieres ahorrar cada mes?</span>
        <div class="amount-input-wrap">
          <span class="sign">$</span>
          <input id="meta" class="amount-input t-transferencia" type="number"
                 step="0.01" min="0" inputmode="decimal" value="${actual || ''}"
                 placeholder="0.00" />
        </div>
      </div>
      <p class="hint">
        Este monto se usa en el KPI “Disponible real”: cada mes se aparta hasta
        cubrir tu meta (con las transferencias a cuentas de ahorro) antes de
        contar lo que te queda libre para gastar.
      </p>
      <button class="btn btn-block" id="save">Guardar meta</button>
    </div>
  `;

  const msg = body.querySelector('#msg');
  const save = body.querySelector('#save');

  save.addEventListener('click', async () => {
    msg.innerHTML = '';
    save.disabled = true;
    save.textContent = 'Guardando…';
    try {
      const saved = await guardarConfiguracion({
        meta_ahorro_mensual: body.querySelector('#meta').value,
      });
      msg.innerHTML = `<div class="msg ok">✅ Meta guardada: ${money(
        saved.meta_ahorro_mensual
      )} al mes.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar.'
      )}</div>`;
    } finally {
      save.disabled = false;
      save.textContent = 'Guardar meta';
    }
  });
}
