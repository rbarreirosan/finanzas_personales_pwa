import {
  getCategorias,
  getPresupuestos,
  guardarPresupuesto,
  eliminarPresupuesto,
} from '../lib/api.js';
import { currentMonth } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Crear / editar un presupuesto (tabla presupuestos). params: cat, mes.
export function PresupuestoFormView(params) {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/presupuestos" aria-label="Volver">‹</a>
          <h1 class="large-title">Presupuesto</h1>
        </div>
      </div>
    </header>
    <div class="screen-body"><div class="loading">Cargando…</div></div>
  `;
  init(el, params).catch((err) => {
    el.querySelector('.screen-body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el, params) {
  const body = el.querySelector('.screen-body');
  const mes = params?.get('mes') || currentMonth();
  const preCat = params?.get('cat') || '';

  const [cats, presupuestos] = await Promise.all([
    getCategorias(),
    getPresupuestos(mes),
  ]);
  const catsGasto = cats.filter((c) => c.tipo === 'gasto');

  const state = { mes };
  const existente = () =>
    presupuestos.find((p) => p.categoria_id === body.querySelector('#cat').value);

  body.innerHTML = `
    <div id="msg"></div>
    <form id="form" class="card">
      <div class="field">
        <span class="f-label">Categoría (de gasto)</span>
        <select id="cat" required>
          <option value="">Selecciona…</option>
          ${catsGasto
            .map(
              (c) =>
                `<option value="${c.id}" ${c.id === preCat ? 'selected' : ''}>${escapeHtml(
                  c.icono || ''
                )} ${escapeHtml(c.nombre)}</option>`
            )
            .join('')}
        </select>
        ${
          catsGasto.length
            ? ''
            : '<span class="hint">Primero crea categorías de gasto en Ajustes → Categorías.</span>'
        }
      </div>
      <div class="field">
        <span class="f-label">Mes</span>
        <input id="mes" type="month" value="${mes}" required />
      </div>
      <div class="field">
        <span class="f-label">Monto presupuestado</span>
        <div class="amount-input-wrap">
          <span class="sign">$</span>
          <input id="monto" class="amount-input t-transferencia" type="number"
                 step="0.01" min="0" inputmode="decimal" placeholder="0.00" required />
        </div>
      </div>
      <div class="switch-row">
        <span class="f-label">Rollover (arrastrar lo no gastado)</span>
        <label class="switch">
          <input id="rollover" type="checkbox" />
          <span class="track"></span>
        </label>
      </div>
      <div id="actions"><button type="submit" class="btn btn-block">Guardar presupuesto</button></div>
    </form>
  `;

  const catSel = body.querySelector('#cat');
  const montoInp = body.querySelector('#monto');
  const rolloverInp = body.querySelector('#rollover');
  const mesInp = body.querySelector('#mes');
  const actions = body.querySelector('#actions');
  const msg = body.querySelector('#msg');

  function syncFromExisting() {
    const ex = existente();
    if (ex) {
      montoInp.value = ex.monto_presupuestado ?? '';
      rolloverInp.checked = !!ex.rollover;
      actions.innerHTML = `
        <div class="btn-actions">
          <button type="button" class="btn-danger" id="del">Eliminar</button>
          <button type="submit" class="btn">Actualizar</button>
        </div>`;
      body.querySelector('#del').addEventListener('click', async () => {
        if (!confirm('¿Eliminar este presupuesto?')) return;
        try {
          await eliminarPresupuesto(ex.id);
          location.hash = '#/presupuestos';
        } catch (err) {
          msg.innerHTML = `<div class="msg error">${escapeHtml(err.message || err)}</div>`;
        }
      });
    } else {
      actions.innerHTML =
        '<button type="submit" class="btn btn-block">Guardar presupuesto</button>';
    }
  }

  catSel.addEventListener('change', syncFromExisting);
  syncFromExisting();

  mesInp.addEventListener('change', async () => {
    state.mes = mesInp.value;
    try {
      const rows = await getPresupuestos(state.mes);
      presupuestos.length = 0;
      presupuestos.push(...rows);
      syncFromExisting();
    } catch {
      /* ignora */
    }
  });

  body.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    try {
      await guardarPresupuesto({
        categoria_id: catSel.value,
        mes: mesInp.value,
        monto_presupuestado: montoInp.value,
        rollover: rolloverInp.checked,
      });
      location.hash = '#/presupuestos';
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar.'
      )}</div>`;
    }
  });
}
