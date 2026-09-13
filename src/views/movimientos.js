import {
  getMovimientos,
  getCuentas,
  getCategorias,
  actualizarTransaccion,
  eliminarTransaccion,
} from '../lib/api.js';
import { money, dayLabel, today } from '../lib/format.js';
import { isPrivate } from '../lib/privacy.js';
import { escapeHtml } from '../lib/dom.js';

const META = {
  ingreso: { emoji: '⬆️', cls: 'c-verde', sign: '+' },
  gasto: { emoji: '⬇️', cls: 'c-rojo', sign: '−' },
  transferencia: { emoji: '🔁', cls: '', sign: '' },
};

// HTML del contenido de una fila de movimiento. Se reutiliza en el Dashboard
// (resumen) y en la pantalla completa (dentro del contenedor deslizable).
export function movItemHtml(m) {
  const meta = META[m.tipo] || META.gasto;
  const title =
    (m.comercio && m.comercio.trim()) ||
    m.categoria_nombre ||
    (m.descripcion && m.descripcion.trim()) ||
    (m.tipo === 'transferencia' ? 'Transferencia' : 'Movimiento');
  const cuentaTxt =
    m.tipo === 'transferencia'
      ? `${m.cuenta_nombre ?? '—'} → ${m.cuenta_destino_nombre ?? '—'}`
      : m.cuenta_nombre ?? '—';
  const sub = `${dayLabel(m.fecha)} · ${cuentaTxt}`;
  const sign = isPrivate() ? '' : meta.sign;

  return `
    <div class="mng-item mov-item">
      <span class="mi-emoji">${meta.emoji}</span>
      <span class="grow">
        <span class="mi-title">${escapeHtml(title)}</span>
        <span class="mi-sub">${escapeHtml(sub)}</span>
      </span>
      <span class="mi-amount tnum ${meta.cls}">${sign}${money(m.monto)}</span>
    </div>`;
}

// Pantalla completa: todos los movimientos. Cada fila se desliza a la derecha
// para revelar "Editar"; al tocarla también se abre la edición.
export function MovimientosView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/dashboard" aria-label="Volver">‹</a>
          <h1 class="large-title">Movimientos</h1>
        </div>
      </div>
    </header>
    <div class="screen-body" id="body"><div class="loading">Cargando…</div></div>
    <div class="modal-backdrop" id="modal" hidden><div class="sheet" id="sheet"></div></div>
  `;

  init(el).catch((err) => {
    el.querySelector('#body').innerHTML = `<div class="msg error">No se pudieron cargar los movimientos: ${escapeHtml(
      err.message || err
    )}</div>`;
  });

  return el;
}

async function init(el) {
  const body = el.querySelector('#body');
  const modal = el.querySelector('#modal');
  const sheet = el.querySelector('#sheet');

  const [movs, cuentas, categorias] = await Promise.all([
    getMovimientos(),
    getCuentas(),
    getCategorias(),
  ]);
  let lista = movs;

  const ACTION_W = 84; // ancho del panel "Editar" que se revela
  let openFg = null; // fila abierta actualmente (para cerrar las demás)

  function closeOpen() {
    if (openFg) {
      openFg.style.transform = 'translateX(0)';
      openFg = null;
    }
  }

  function renderList() {
    closeOpen();
    if (!lista.length) {
      body.innerHTML =
        '<div class="empty">Aún no tienes movimientos.<br>Toca “Nuevo” abajo para registrar el primero.</div>';
      return;
    }
    body.innerHTML = '';
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    lista.forEach((m) => col.appendChild(buildRow(m)));
    body.appendChild(col);
  }

  // ---------- Fila deslizable ----------
  function buildRow(m) {
    const wrap = document.createElement('div');
    wrap.className = 'swipe-wrap';
    wrap.innerHTML = `
      <div class="swipe-action">
        <button type="button" aria-label="Editar">
          <span class="sa-ic">✏️</span><span>Editar</span>
        </button>
      </div>
      <div class="swipe-fg">${movItemHtml(m)}</div>
    `;
    const fg = wrap.querySelector('.swipe-fg');
    wrap.querySelector('.swipe-action button').addEventListener('click', () => {
      closeOpen();
      openEdit(m);
    });

    // Gestos táctiles: deslizar a la derecha revela "Editar".
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    let decided = false;
    let horizontal = false;

    const isOpen = () => openFg === fg;

    fg.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        dx = 0;
        dragging = true;
        decided = false;
        horizontal = false;
        fg.style.transition = 'none';
      },
      { passive: true }
    );

    fg.addEventListener(
      'touchmove',
      (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          decided = true;
          horizontal = Math.abs(dx) > Math.abs(dy);
          if (horizontal) closeOtherThan(fg);
        }
        if (!horizontal) return;
        e.preventDefault(); // bloquea el scroll vertical mientras deslizamos
        let x = (isOpen() ? ACTION_W : 0) + dx;
        if (x < 0) x = 0;
        if (x > ACTION_W) x = ACTION_W + (x - ACTION_W) * 0.2; // efecto elástico
        fg.style.transform = `translateX(${x}px)`;
      },
      { passive: false }
    );

    fg.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      fg.style.transition = '';
      if (!horizontal) return;
      const finalX = (isOpen() ? ACTION_W : 0) + dx;
      if (finalX > ACTION_W / 2) {
        fg.style.transform = `translateX(${ACTION_W}px)`;
        openFg = fg;
      } else {
        fg.style.transform = 'translateX(0)';
        if (isOpen()) openFg = null;
      }
    });

    // Tocar la fila: si está abierta, se cierra; si está cerrada, edita.
    fg.addEventListener('click', () => {
      if (decided && horizontal) return; // fue un deslizamiento, no un toque
      if (isOpen()) {
        closeOpen();
        return;
      }
      openEdit(m);
    });

    return wrap;
  }

  function closeOtherThan(fg) {
    if (openFg && openFg !== fg) {
      openFg.style.transform = 'translateX(0)';
      openFg = null;
    }
  }

  // ---------- Hoja de edición ----------
  function openEdit(m) {
    const state = { tipo: m.tipo };
    const cuentaOpts = (sel) =>
      '<option value="">Selecciona…</option>' +
      cuentas
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${escapeHtml(
              c.nombre
            )}</option>`
        )
        .join('');

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar">
        <h2>Editar movimiento</h2>
        <button class="sheet-close" id="close" aria-label="Cerrar">✕</button>
      </div>
      <form id="edit-form">
        <div id="edit-msg"></div>
        <div class="seg" id="tipo-seg" style="margin-bottom:14px">
          <button type="button" data-tipo="ingreso">Ingreso</button>
          <button type="button" data-tipo="gasto">Gasto</button>
          <button type="button" data-tipo="transferencia">Transferencia</button>
        </div>
        <div class="field">
          <span class="f-label">Monto</span>
          <input id="monto" type="number" step="0.01" min="0.01" inputmode="decimal"
                 value="${Number(m.monto)}" required />
        </div>
        <div class="field">
          <span class="f-label">Fecha</span>
          <input id="fecha" type="date" value="${escapeHtml(
            String(m.fecha).slice(0, 10) || today()
          )}" required />
        </div>
        <div id="details"></div>
        <div class="btn-actions" style="margin-top:6px">
          <button type="button" class="btn-danger" id="del">Eliminar</button>
          <button type="submit" class="btn" id="save">Actualizar</button>
        </div>
      </form>
    `;

    const details = sheet.querySelector('#details');
    const segBtns = sheet.querySelectorAll('#tipo-seg button');

    function renderDetails() {
      if (state.tipo === 'transferencia') {
        details.innerHTML = `
          <div class="field">
            <span class="f-label">Cuenta origen</span>
            <select id="cuenta">${cuentaOpts(m.cuenta_id)}</select>
          </div>
          <div class="field">
            <span class="f-label">Cuenta destino</span>
            <select id="cuenta_destino">${cuentaOpts(m.cuenta_destino_id)}</select>
          </div>
          <div class="field">
            <span class="f-label">Descripción</span>
            <input id="descripcion" type="text" placeholder="Opcional" value="${escapeHtml(
              m.descripcion || ''
            )}" />
          </div>`;
      } else {
        const tipoCat = state.tipo === 'ingreso' ? 'ingreso' : 'gasto';
        const cats = categorias.filter((c) => c.tipo === tipoCat);
        const catOpts =
          '<option value="">Selecciona…</option>' +
          cats
            .map(
              (c) =>
                `<option value="${c.id}"${
                  c.id === m.categoria_id ? ' selected' : ''
                }>${escapeHtml(c.icono || '')} ${escapeHtml(c.nombre)}</option>`
            )
            .join('');
        details.innerHTML = `
          <div class="field">
            <span class="f-label">Cuenta</span>
            <select id="cuenta">${cuentaOpts(m.cuenta_id)}</select>
          </div>
          <div class="field">
            <span class="f-label">Categoría</span>
            <select id="categoria">${catOpts}</select>
          </div>
          <div class="field">
            <span class="f-label">Comercio</span>
            <input id="comercio" type="text" placeholder="Opcional" value="${escapeHtml(
              m.comercio || ''
            )}" />
          </div>
          <div class="field">
            <span class="f-label">Descripción</span>
            <input id="descripcion" type="text" placeholder="Opcional" value="${escapeHtml(
              m.descripcion || ''
            )}" />
          </div>`;
      }
    }

    segBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.tipo === state.tipo);
      b.addEventListener('click', () => {
        state.tipo = b.dataset.tipo;
        segBtns.forEach((x) => x.classList.toggle('active', x === b));
        renderDetails();
      });
    });
    renderDetails();

    sheet.querySelector('#close').addEventListener('click', closeModal);
    sheet.querySelector('#del').addEventListener('click', () => onDelete(m));
    sheet.querySelector('#edit-form').addEventListener('submit', (e) =>
      onSubmit(e, m, state)
    );

    modal.hidden = false;
    document.body.classList.add('modal-open');
    sheet.scrollTop = 0;
  }

  function closeModal() {
    modal.hidden = true;
    sheet.innerHTML = '';
    document.body.classList.remove('modal-open');
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  async function refresh() {
    lista = await getMovimientos();
    renderList();
  }

  async function onSubmit(e, m, state) {
    e.preventDefault();
    const msg = sheet.querySelector('#edit-msg');
    const save = sheet.querySelector('#save');
    msg.innerHTML = '';
    const mov = {
      fecha: sheet.querySelector('#fecha').value,
      tipo: state.tipo,
      monto: sheet.querySelector('#monto').value,
      cuenta_id: sheet.querySelector('#cuenta')?.value || null,
      cuenta_destino_id: sheet.querySelector('#cuenta_destino')?.value || null,
      categoria_id: sheet.querySelector('#categoria')?.value || null,
      comercio: sheet.querySelector('#comercio')?.value || '',
      descripcion: sheet.querySelector('#descripcion')?.value || '',
      etiquetas: m.etiquetas || '',
    };
    save.disabled = true;
    save.textContent = 'Guardando…';
    try {
      await actualizarTransaccion(m.id, mov);
      closeModal();
      await refresh();
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar.'
      )}</div>`;
      save.disabled = false;
      save.textContent = 'Actualizar';
    }
  }

  async function onDelete(m) {
    if (!confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
    const msg = sheet.querySelector('#edit-msg');
    try {
      await eliminarTransaccion(m.id);
      closeModal();
      await refresh();
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo eliminar.'
      )}</div>`;
    }
  }

  renderList();
}
