import { listCuentas, guardarCuenta, eliminarCuenta } from '../lib/api.js';
import { money0 } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

const TIPOS = [
  { v: 'debito', l: 'Débito', e: '💳' },
  { v: 'efectivo', l: 'Efectivo', e: '💵' },
  { v: 'credito', l: 'Crédito', e: '🏦' },
  { v: 'ahorro', l: 'Ahorro', e: '🐷' },
];
const tipoLabel = (v) => TIPOS.find((t) => t.v === v)?.l || v;
const tipoEmoji = (v) => TIPOS.find((t) => t.v === v)?.e || '💳';

export function CuentasView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <h1 class="large-title">Cuentas</h1>
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
  let cuentas = await listCuentas();
  const state = { id: null, tipo: 'debito', activa: true };

  function reset() {
    state.id = null;
    state.tipo = 'debito';
    state.activa = true;
  }

  function render() {
    body.innerHTML = `
      <div id="msg"></div>

      <p class="form-title">Tus cuentas</p>
      <div id="lista" style="display:flex;flex-direction:column;gap:8px"></div>

      <p class="form-title" id="form-title">Nueva cuenta</p>
      <form id="form" class="card">
        <div class="field">
          <span class="f-label">Nombre</span>
          <input id="nombre" type="text" placeholder="Ej. Débito BBVA" required />
        </div>
        <div class="field">
          <span class="f-label">Tipo</span>
          <div class="seg" id="tipo-seg">
            ${TIPOS.map(
              (t) =>
                `<button type="button" data-tipo="${t.v}">${t.l}</button>`
            ).join('')}
          </div>
        </div>
        <div class="field">
          <span class="f-label">Saldo inicial</span>
          <input id="saldo" type="number" step="0.01" inputmode="decimal" placeholder="0.00" />
        </div>
        <div class="field" id="limite-wrap" hidden>
          <span class="f-label">Límite de crédito</span>
          <input id="limite" type="number" step="0.01" inputmode="decimal" placeholder="0.00" />
        </div>
        <div class="switch-row">
          <span class="f-label">Cuenta activa</span>
          <label class="switch">
            <input id="activa" type="checkbox" checked />
            <span class="track"></span>
          </label>
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
    if (!cuentas.length) {
      lista.innerHTML = '<div class="empty">Aún no tienes cuentas. Crea la primera abajo.</div>';
      return;
    }
    lista.innerHTML = cuentas
      .map(
        (c) => `
        <button type="button" class="mng-item ${
          c.id === state.id ? 'selected' : ''
        }" data-id="${c.id}">
          <span class="mi-emoji">${tipoEmoji(c.tipo)}</span>
          <span class="grow">
            <span class="mi-title">${escapeHtml(c.nombre)}${
          c.activa ? '' : ' · (inactiva)'
        }</span>
            <span class="mi-sub">${tipoLabel(c.tipo)}</span>
          </span>
          <span class="mi-amount">${money0(c.saldo_inicial)}</span>
        </button>`
      )
      .join('');
    lista.querySelectorAll('.mng-item').forEach((b) =>
      b.addEventListener('click', () => selectCuenta(b.dataset.id))
    );
  }

  function fillForm() {
    const seg = body.querySelectorAll('#tipo-seg button');
    seg.forEach((b) => b.classList.toggle('active', b.dataset.tipo === state.tipo));
    body.querySelector('#limite-wrap').hidden = state.tipo !== 'credito';
    body.querySelector('#form-title').textContent = state.id
      ? 'Editar cuenta'
      : 'Nueva cuenta';
    body.querySelector('#actions').innerHTML = state.id
      ? `<div class="btn-actions">
           <button type="button" class="btn-danger" id="del">Eliminar</button>
           <button type="submit" class="btn">Actualizar</button>
         </div>
         <button type="button" class="btn-secondary" id="cancel" style="margin-top:10px">Cancelar</button>`
      : `<button type="submit" class="btn btn-block">Guardar cuenta</button>`;
  }

  function selectCuenta(id) {
    const c = cuentas.find((x) => x.id === id);
    if (!c) return;
    state.id = c.id;
    state.tipo = c.tipo;
    state.activa = c.activa;
    render();
    body.querySelector('#nombre').value = c.nombre || '';
    body.querySelector('#saldo').value = c.saldo_inicial ?? '';
    body.querySelector('#activa').checked = c.activa !== false;
    if (c.tipo === 'credito')
      body.querySelector('#limite').value = c.limite_credito ?? '';
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
        body.querySelector('#limite-wrap').hidden = state.tipo !== 'credito';
      })
    );

    body.querySelector('#cancel')?.addEventListener('click', () => {
      reset();
      render();
    });

    body.querySelector('#del')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta cuenta? (No podrás si tiene movimientos.)')) return;
      try {
        await eliminarCuenta(state.id);
        cuentas = await listCuentas();
        reset();
        render();
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo eliminar (¿tiene movimientos asociados?).'
        )}</div>`;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.innerHTML = '';
      try {
        await guardarCuenta(
          {
            nombre: body.querySelector('#nombre').value,
            tipo: state.tipo,
            saldo_inicial: body.querySelector('#saldo').value,
            limite_credito: body.querySelector('#limite')?.value || null,
            activa: body.querySelector('#activa').checked,
          },
          state.id
        );
        cuentas = await listCuentas();
        reset();
        render();
        body.querySelector('#msg').innerHTML =
          '<div class="msg ok">✅ Cuenta guardada.</div>';
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo guardar.'
        )}</div>`;
      }
    });
  }

  render();
}
