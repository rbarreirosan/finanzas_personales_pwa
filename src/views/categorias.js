import { getCategorias, guardarCategoria, eliminarCategoria } from '../lib/api.js';
import { escapeHtml } from '../lib/dom.js';

export function CategoriasView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/ajustes" aria-label="Volver">‹</a>
          <h1 class="large-title">Categorías</h1>
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
  let cats = await getCategorias();
  const state = { id: null, tipo: 'gasto', grupo: 'discrecional', color: '#6366F1' };

  function reset() {
    state.id = null;
    state.tipo = 'gasto';
    state.grupo = 'discrecional';
    state.color = '#6366F1';
  }

  function render() {
    body.innerHTML = `
      <div id="msg"></div>

      <p class="form-title">Tus categorías</p>
      <div id="lista" style="display:flex;flex-direction:column;gap:8px"></div>

      <p class="form-title" id="form-title">Nueva categoría</p>
      <form id="form" class="card">
        <div class="field">
          <span class="f-label">Tipo</span>
          <div class="seg" id="tipo-seg">
            <button type="button" data-tipo="ingreso">Ingreso</button>
            <button type="button" data-tipo="gasto">Gasto</button>
          </div>
        </div>
        <div class="field" id="grupo-wrap">
          <span class="f-label">Grupo (del gasto)</span>
          <div class="seg" id="grupo-seg">
            <button type="button" data-grupo="esencial">Esencial</button>
            <button type="button" data-grupo="discrecional">Discrecional</button>
          </div>
        </div>
        <div class="field">
          <span class="f-label">Nombre</span>
          <input id="nombre" type="text" placeholder="Ej. Despensa" required />
        </div>
        <div style="display:flex;gap:12px">
          <div class="field" style="flex:0 0 90px">
            <span class="f-label">Ícono</span>
            <input id="icono" type="text" maxlength="2" placeholder="🛒" style="text-align:center" />
          </div>
          <div class="field" style="flex:1">
            <span class="f-label">Color</span>
            <input id="color" type="color" value="${state.color}" />
          </div>
        </div>
        <div id="actions"></div>
      </form>
    `;
    renderList();
    fillForm();
    bind();
  }

  function renderList() {
    const lista = body.querySelector('#lista');
    if (!cats.length) {
      lista.innerHTML =
        '<div class="empty">Aún no tienes categorías. Crea la primera abajo.</div>';
      return;
    }
    lista.innerHTML = cats
      .map(
        (c) => `
        <button type="button" class="mng-item ${
          c.id === state.id ? 'selected' : ''
        }" data-id="${c.id}">
          <span class="mi-emoji">${escapeHtml(c.icono || '💸')}</span>
          <span class="grow">
            <span class="mi-title">${escapeHtml(c.nombre)}</span>
            <span class="mi-sub">${c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto · ' +
              (c.grupo === 'esencial' ? 'Esencial' : 'Discrecional')}</span>
          </span>
          <span class="dot-color" style="background:${escapeHtml(c.color || '#94A3B8')}"></span>
        </button>`
      )
      .join('');
    lista.querySelectorAll('.mng-item').forEach((b) =>
      b.addEventListener('click', () => selectCat(b.dataset.id))
    );
  }

  function fillForm() {
    body
      .querySelectorAll('#tipo-seg button')
      .forEach((b) => b.classList.toggle('active', b.dataset.tipo === state.tipo));
    body
      .querySelectorAll('#grupo-seg button')
      .forEach((b) => b.classList.toggle('active', b.dataset.grupo === state.grupo));
    body.querySelector('#grupo-wrap').hidden = state.tipo !== 'gasto';
    body.querySelector('#form-title').textContent = state.id
      ? 'Editar categoría'
      : 'Nueva categoría';
    body.querySelector('#actions').innerHTML = state.id
      ? `<div class="btn-actions">
           <button type="button" class="btn-danger" id="del">Eliminar</button>
           <button type="submit" class="btn">Actualizar</button>
         </div>
         <button type="button" class="btn-secondary" id="cancel" style="margin-top:10px">Cancelar</button>`
      : `<button type="submit" class="btn btn-block">Guardar categoría</button>`;
  }

  function selectCat(id) {
    const c = cats.find((x) => x.id === id);
    if (!c) return;
    state.id = c.id;
    state.tipo = c.tipo;
    state.grupo = c.grupo === 'ingreso' ? 'discrecional' : c.grupo;
    state.color = c.color || '#6366F1';
    render();
    body.querySelector('#nombre').value = c.nombre || '';
    body.querySelector('#icono').value = c.icono || '';
    body.querySelector('#color').value = c.color || '#6366F1';
    window.scrollTo({ top: body.querySelector('#form').offsetTop, behavior: 'smooth' });
  }

  function bind() {
    const form = body.querySelector('#form');
    const msg = body.querySelector('#msg');

    body.querySelectorAll('#tipo-seg button').forEach((b) =>
      b.addEventListener('click', () => {
        state.tipo = b.dataset.tipo;
        body
          .querySelectorAll('#tipo-seg button')
          .forEach((x) => x.classList.toggle('active', x === b));
        body.querySelector('#grupo-wrap').hidden = state.tipo !== 'gasto';
      })
    );
    body.querySelectorAll('#grupo-seg button').forEach((b) =>
      b.addEventListener('click', () => {
        state.grupo = b.dataset.grupo;
        body
          .querySelectorAll('#grupo-seg button')
          .forEach((x) => x.classList.toggle('active', x === b));
      })
    );

    body.querySelector('#cancel')?.addEventListener('click', () => {
      reset();
      render();
    });

    body.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta categoría?')) return;
      try {
        await eliminarCategoria(state.id);
        cats = await getCategorias();
        reset();
        render();
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo eliminar (¿tiene movimientos o presupuestos?).'
        )}</div>`;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.innerHTML = '';
      try {
        await guardarCategoria(
          {
            nombre: body.querySelector('#nombre').value,
            tipo: state.tipo,
            grupo: state.grupo,
            icono: body.querySelector('#icono').value,
            color: body.querySelector('#color').value,
          },
          state.id
        );
        cats = await getCategorias();
        reset();
        render();
        body.querySelector('#msg').innerHTML =
          '<div class="msg ok">✅ Categoría guardada.</div>';
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo guardar.'
        )}</div>`;
      }
    });
  }

  render();
}
