import {
  listMetas,
  listMetaItems,
  crearMeta,
  actualizarMeta,
  eliminarMeta,
  MAX_METAS_ACTIVAS,
} from '../lib/api.js';
import { apartarMensual, mesesRestantes, totalMeta, invertidoMeta } from '../lib/metasCalc.js';
import { money } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

const EMOJIS = ['🎯', '🔧', '📦', '🚗', '💻', '🏠', '🎓', '📷', '🛠️', '✈️', '💍', '🎮'];

// Crear o editar una meta. #/meta-form (crear) · #/meta-form?id=X (editar).
export function MetaFormView(params) {
  const id = params?.get('id') || null;
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="${id ? `#/meta-detalle?id=${id}` : '#/metas'}" aria-label="Volver">‹</a>
          <h1 class="large-title">${id ? 'Editar meta' : 'Nueva meta'}</h1>
        </div>
      </div>
    </header>
    <div class="screen-body" id="mf-body"><div class="loading">Cargando…</div></div>
  `;
  init(el, id).catch((err) => {
    el.querySelector('#mf-body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el, id) {
  const body = el.querySelector('#mf-body');
  const metas = await listMetas();
  const editando = Boolean(id);

  // Al crear: no permitir más de MAX metas activas.
  if (!editando) {
    const activas = metas.filter((m) => m.activa).length;
    if (activas >= MAX_METAS_ACTIVAS) {
      body.innerHTML = `
        <div class="msg error" style="margin-top:8px">
          Por ahora puedes tener ${MAX_METAS_ACTIVAS} metas activas. Termina o borra una para abrir otra.
        </div>
        <a class="btn btn-block" href="#/metas" style="text-decoration:none;text-align:center;margin-top:12px">Volver a Metas</a>`;
      return;
    }
  }

  const meta = editando ? metas.find((m) => m.id === id) : null;
  if (editando && !meta) {
    body.innerHTML = '<div class="msg error">No se encontró la meta.</div>';
    return;
  }

  let items = [];
  if (editando) {
    const all = await listMetaItems();
    items = all.filter((it) => it.meta_id === id);
  }

  const state = {
    nombre: meta?.nombre || '',
    emoji: meta?.emoji || '🎯',
    fecha: meta?.fecha_objetivo ? String(meta.fecha_objetivo).slice(0, 10) : '',
  };

  body.innerHTML = `
    <div id="mf-msg"></div>
    <div class="card meta-card-form">
      <div class="field">
        <span class="f-label">Nombre de la meta</span>
        <input id="mf-nombre" type="text" placeholder="Ej. Taller mecánico" value="${escapeHtml(
          state.nombre
        )}" />
      </div>
      <div class="field">
        <span class="f-label">Ícono</span>
        <div class="emoji-grid" id="mf-emojis">
          ${EMOJIS.map(
            (e) =>
              `<button type="button" class="emoji-btn ${
                e === state.emoji ? 'active' : ''
              }" data-e="${e}">${e}</button>`
          ).join('')}
        </div>
      </div>
      <div class="field">
        <span class="f-label">Fecha objetivo <span class="opt">(opcional)</span></span>
        <input id="mf-fecha" type="date" value="${state.fecha}" />
      </div>
      <div id="mf-hint"></div>
    </div>
    <button class="btn btn-block meta-btn" id="mf-save" style="margin-top:16px">Guardar meta</button>
    ${
      editando
        ? '<button class="btn-danger" id="mf-del" style="margin-top:12px">Eliminar meta</button>'
        : ''
    }
  `;

  const nombreInp = body.querySelector('#mf-nombre');
  const fechaInp = body.querySelector('#mf-fecha');
  const hintBox = body.querySelector('#mf-hint');
  const msg = body.querySelector('#mf-msg');
  const saveBtn = body.querySelector('#mf-save');

  body.querySelectorAll('.emoji-btn').forEach((b) =>
    b.addEventListener('click', () => {
      state.emoji = b.dataset.e;
      body
        .querySelectorAll('.emoji-btn')
        .forEach((x) => x.classList.toggle('active', x === b));
    })
  );

  function renderHint() {
    const fecha = fechaInp.value;
    if (!fecha) {
      hintBox.innerHTML = '';
      return;
    }
    const apartar = apartarMensual(items, fecha);
    const meses = mesesRestantes(fecha);
    const falta = Math.max(0, totalMeta(items) - invertidoMeta(items));
    if (editando && apartar != null && apartar > 0) {
      hintBox.innerHTML = `
        <div class="meta-hint">
          <div class="mh-monto">Te toca apartar ≈ ${money(apartar)} al mes</div>
          <div class="mh-nota">Faltan ${meses} meses para tu fecha objetivo y ${money(
        falta
      )} por invertir.</div>
        </div>`;
    } else {
      hintBox.innerHTML = `
        <div class="meta-hint">
          <div class="mh-nota">Se recalcula en cuanto agregues ítems a la meta.</div>
        </div>`;
    }
  }
  fechaInp.addEventListener('change', renderHint);
  renderHint();

  const delBtn = body.querySelector('#mf-del');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta meta y todos sus ítems? No se puede deshacer.')) return;
      delBtn.disabled = true;
      try {
        await eliminarMeta(id);
        location.hash = '#/metas';
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo eliminar.'
        )}</div>`;
        delBtn.disabled = false;
      }
    });
  }

  saveBtn.addEventListener('click', async () => {
    msg.innerHTML = '';
    const nombre = nombreInp.value.trim();
    if (!nombre) {
      msg.innerHTML = '<div class="msg error">Ponle un nombre a la meta.</div>';
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    try {
      const payload = { nombre, emoji: state.emoji, fecha_objetivo: fechaInp.value || null };
      if (editando) {
        await actualizarMeta(id, payload);
        location.hash = `#/meta-detalle?id=${id}`;
      } else {
        const nueva = await crearMeta(payload);
        location.hash = `#/meta-detalle?id=${nueva.id}`;
      }
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar.'
      )}</div>`;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar meta';
    }
  });
}
