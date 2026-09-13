import { listCuentas, guardarCuenta, eliminarCuenta } from '../lib/api.js';
import { money } from '../lib/format.js';
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
        <button class="icon-btn" id="add-btn" aria-label="Nueva cuenta">+</button>
      </div>
    </header>
    <div class="screen-body" id="body"><div class="loading">Cargando…</div></div>
    <div class="modal-backdrop" id="modal" hidden><div class="sheet" id="sheet"></div></div>
  `;
  init(el).catch((err) => {
    el.querySelector('#body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el) {
  const body = el.querySelector('#body');
  const modal = el.querySelector('#modal');
  const sheet = el.querySelector('#sheet');
  let cuentas = await listCuentas();
  const state = { id: null, tipo: 'debito' };

  // ---------- Lista ----------
  function renderList() {
    if (!cuentas.length) {
      body.innerHTML =
        '<div class="empty">Aún no tienes cuentas.<br>Toca “+” arriba para crear la primera.</div>';
      return;
    }
    body.innerHTML =
      '<p class="form-title">Tus cuentas</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      cuentas
        .map(
          (c) => `
        <button type="button" class="mng-item" data-id="${c.id}">
          <span class="mi-emoji">${tipoEmoji(c.tipo)}</span>
          <span class="grow">
            <span class="mi-title">${escapeHtml(c.nombre)}${
            c.activa ? '' : ' · (inactiva)'
          }</span>
            <span class="mi-sub">${tipoLabel(c.tipo)}</span>
          </span>
          <span class="mi-amount">${money(c.saldo_actual ?? c.saldo_inicial)}</span>
        </button>`
        )
        .join('') +
      '</div>';
    body.querySelectorAll('.mng-item').forEach((b) =>
      b.addEventListener('click', () =>
        openModal(cuentas.find((x) => x.id === b.dataset.id))
      )
    );
  }

  // ---------- Modal ----------
  function openModal(cuenta = null) {
    state.id = cuenta?.id || null;
    state.tipo = cuenta?.tipo || 'debito';
    const editing = Boolean(cuenta);

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar">
        <h2>${editing ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
        <button class="sheet-close" id="close" aria-label="Cerrar">✕</button>
      </div>
      <form id="form">
        <div id="msg"></div>
        <div class="field">
          <span class="f-label">Nombre</span>
          <input id="nombre" type="text" placeholder="Ej. Débito BBVA" required />
        </div>
        <div class="field">
          <span class="f-label">Tipo</span>
          <div class="seg" id="tipo-seg">
            ${TIPOS.map(
              (t) => `<button type="button" data-tipo="${t.v}">${t.l}</button>`
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
        <div id="actions" style="margin-top:6px"></div>
      </form>
    `;

    // Prefill / acciones
    const seg = sheet.querySelectorAll('#tipo-seg button');
    seg.forEach((b) => b.classList.toggle('active', b.dataset.tipo === state.tipo));
    sheet.querySelector('#limite-wrap').hidden = state.tipo !== 'credito';
    sheet.querySelector('#actions').innerHTML = editing
      ? `<div class="btn-actions">
           <button type="button" class="btn-danger" id="del">Eliminar</button>
           <button type="submit" class="btn">Actualizar</button>
         </div>`
      : `<button type="submit" class="btn btn-block">Guardar cuenta</button>`;

    if (editing) {
      sheet.querySelector('#nombre').value = cuenta.nombre || '';
      sheet.querySelector('#saldo').value = cuenta.saldo_inicial ?? '';
      sheet.querySelector('#activa').checked = cuenta.activa !== false;
      if (cuenta.tipo === 'credito')
        sheet.querySelector('#limite').value = cuenta.limite_credito ?? '';
    }

    // Eventos del formulario
    seg.forEach((b) =>
      b.addEventListener('click', () => {
        state.tipo = b.dataset.tipo;
        seg.forEach((x) => x.classList.toggle('active', x === b));
        sheet.querySelector('#limite-wrap').hidden = state.tipo !== 'credito';
      })
    );
    sheet.querySelector('#close').addEventListener('click', closeModal);
    sheet.querySelector('#del')?.addEventListener('click', onDelete);
    sheet.querySelector('#form').addEventListener('submit', onSubmit);

    modal.hidden = false;
    document.body.classList.add('modal-open');
    sheet.scrollTop = 0;
    sheet.querySelector('#nombre').focus();
  }

  function closeModal() {
    modal.hidden = true;
    sheet.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  // Cerrar tocando el fondo (fuera de la hoja)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  async function onDelete() {
    if (!confirm('¿Eliminar esta cuenta? (No se puede si tiene movimientos.)')) return;
    const msg = sheet.querySelector('#msg');
    try {
      await eliminarCuenta(state.id);
      cuentas = await listCuentas();
      closeModal();
      renderList();
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo eliminar (¿tiene movimientos asociados?).'
      )}</div>`;
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const msg = sheet.querySelector('#msg');
    msg.innerHTML = '';
    try {
      await guardarCuenta(
        {
          nombre: sheet.querySelector('#nombre').value,
          tipo: state.tipo,
          saldo_inicial: sheet.querySelector('#saldo').value,
          limite_credito: sheet.querySelector('#limite')?.value || null,
          activa: sheet.querySelector('#activa').checked,
        },
        state.id
      );
      cuentas = await listCuentas();
      closeModal();
      renderList();
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar.'
      )}</div>`;
    }
  }

  el.querySelector('#add-btn').addEventListener('click', () => openModal(null));
  renderList();
}
