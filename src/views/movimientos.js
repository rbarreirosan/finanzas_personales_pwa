import {
  getMovimientos,
  getCuentas,
  getCategorias,
  actualizarTransaccion,
  eliminarTransaccion,
} from '../lib/api.js';
import { money, dayLabel, today, currentMonth, monthLabel } from '../lib/format.js';
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

// 'YYYY-MM' desplazado `delta` meses.
function shiftMonth(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "Septiembre 2026" (sin el "de", como el diseño de referencia).
const mesLabel = (mes) => cap(monthLabel(mes).replace(' de ', ' '));

// Pantalla completa: movimientos por mes, con filtro por fecha y "+" para nuevo.
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
        <a class="icon-btn" href="#/nuevo" aria-label="Nuevo movimiento">+</a>
      </div>
    </header>
    <div class="mov-filter" id="filter"></div>
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
  const filter = el.querySelector('#filter');
  const modal = el.querySelector('#modal');
  const sheet = el.querySelector('#sheet');

  const [movs, cuentas, categorias] = await Promise.all([
    getMovimientos(),
    getCuentas(),
    getCategorias(),
  ]);
  let todos = movs;

  // Estado del filtro: por mes (navegable) o por rango de fechas (calendario).
  const state = { mode: 'month', mes: currentMonth(), rStart: null, rEnd: null };

  function visibles() {
    if (state.mode === 'rango') {
      return todos.filter((m) => {
        const d = String(m.fecha).slice(0, 10);
        return d >= state.rStart && d <= state.rEnd;
      });
    }
    return todos.filter((m) => String(m.fecha).slice(0, 7) === state.mes);
  }

  function rangoLabel() {
    return state.rStart === state.rEnd
      ? dayLabel(state.rStart)
      : `${dayLabel(state.rStart)} – ${dayLabel(state.rEnd)}`;
  }

  // ---------- Barra de filtro (mes / calendario) ----------
  function renderFilter() {
    if (state.mode === 'rango') {
      filter.innerHTML = `
        <button class="mf-chip" id="mf-clear" aria-label="Quitar filtro">
          <span>${escapeHtml(rangoLabel())}</span><span class="mf-x">✕</span>
        </button>
        <button class="mf-cal active" id="mf-cal" aria-label="Filtrar por fecha">📅</button>`;
      filter.querySelector('#mf-clear').addEventListener('click', () => {
        state.mode = 'month';
        renderFilter();
        renderList();
      });
    } else {
      filter.innerHTML = `
        <div class="mf-nav-wrap">
          <button class="mf-hoy" id="mf-hoy">Hoy</button>
          <button class="mf-nav" id="mf-prev" aria-label="Mes anterior">‹</button>
          <span class="mf-mes">${escapeHtml(mesLabel(state.mes))}</span>
          <button class="mf-nav" id="mf-next" aria-label="Mes siguiente">›</button>
        </div>
        <button class="mf-cal" id="mf-cal" aria-label="Filtrar por fecha">📅</button>`;
      filter.querySelector('#mf-hoy').addEventListener('click', () => {
        state.mes = currentMonth();
        renderFilter();
        renderList();
      });
      filter.querySelector('#mf-prev').addEventListener('click', () => {
        state.mes = shiftMonth(state.mes, -1);
        renderFilter();
        renderList();
      });
      filter.querySelector('#mf-next').addEventListener('click', () => {
        state.mes = shiftMonth(state.mes, 1);
        renderFilter();
        renderList();
      });
    }
    filter.querySelector('#mf-cal').addEventListener('click', openCalendar);
  }

  // ---------- Hoja: filtro por calendario (un día o intervalo) ----------
  function openCalendar() {
    const cst = {
      modo: state.mode === 'rango' && state.rStart !== state.rEnd ? 'intervalo' : 'dia',
    };
    const d1 = state.mode === 'rango' ? state.rStart : today();
    const d2 = state.mode === 'rango' ? state.rEnd : today();

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar"><h2>Filtrar por fecha</h2>
        <button class="sheet-close" id="c-close" aria-label="Cerrar">✕</button></div>
      <div id="c-msg"></div>
      <div class="seg" id="c-modo" style="margin-bottom:14px">
        <button type="button" data-m="dia">Un día</button>
        <button type="button" data-m="intervalo">Intervalo</button>
      </div>
      <div id="c-fields"></div>
      <button class="btn btn-block" id="c-aplicar" style="margin-top:8px">Aplicar filtro</button>
      ${
        state.mode === 'rango'
          ? '<button class="btn-ghost" id="c-quitar" style="margin-top:10px">Ver por mes</button>'
          : ''
      }
    `;

    const fields = sheet.querySelector('#c-fields');
    function renderFields() {
      fields.innerHTML =
        cst.modo === 'dia'
          ? `<div class="field"><span class="f-label">Día</span>
               <input id="c-d1" type="date" value="${d1}" /></div>`
          : `<div class="field"><span class="f-label">Desde</span>
               <input id="c-d1" type="date" value="${d1}" /></div>
             <div class="field"><span class="f-label">Hasta</span>
               <input id="c-d2" type="date" value="${d2}" /></div>`;
    }
    sheet.querySelectorAll('#c-modo button').forEach((b) => {
      b.classList.toggle('active', b.dataset.m === cst.modo);
      b.addEventListener('click', () => {
        cst.modo = b.dataset.m;
        sheet.querySelectorAll('#c-modo button').forEach((x) => x.classList.toggle('active', x === b));
        renderFields();
      });
    });
    renderFields();

    sheet.querySelector('#c-close').addEventListener('click', closeModal);
    sheet.querySelector('#c-quitar')?.addEventListener('click', () => {
      state.mode = 'month';
      closeModal();
      renderFilter();
      renderList();
    });
    sheet.querySelector('#c-aplicar').addEventListener('click', () => {
      const msg = sheet.querySelector('#c-msg');
      msg.innerHTML = '';
      const v1 = sheet.querySelector('#c-d1').value;
      if (cst.modo === 'dia') {
        if (!v1) { msg.innerHTML = '<div class="msg error">Elige un día.</div>'; return; }
        state.rStart = state.rEnd = v1;
      } else {
        const v2 = sheet.querySelector('#c-d2').value;
        if (!v1 || !v2) { msg.innerHTML = '<div class="msg error">Elige las dos fechas.</div>'; return; }
        state.rStart = v1 <= v2 ? v1 : v2;
        state.rEnd = v1 <= v2 ? v2 : v1;
      }
      state.mode = 'rango';
      closeModal();
      renderFilter();
      renderList();
    });

    openSheet();
  }

  // ---------- Lista ----------
  const ACTION_W = 84;
  let openFg = null;

  function closeOpen() {
    if (openFg) {
      openFg.style.transform = 'translateX(0)';
      openFg = null;
    }
  }

  function renderList() {
    closeOpen();
    const lista = visibles();
    if (!todos.length) {
      body.innerHTML =
        '<div class="empty">Aún no tienes movimientos.<br>Toca “+” arriba para registrar el primero.</div>';
      return;
    }
    if (!lista.length) {
      body.innerHTML = `<div class="empty">No hay movimientos ${
        state.mode === 'rango' ? 'en este rango' : 'en ' + mesLabel(state.mes)
      }.</div>`;
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

    let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
    const isOpen = () => openFg === fg;

    fg.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; dx = 0;
      dragging = true; decided = false; horizontal = false;
      fg.style.transition = 'none';
    }, { passive: true });

    fg.addEventListener('touchmove', (e) => {
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
      e.preventDefault();
      let x = (isOpen() ? ACTION_W : 0) + dx;
      if (x < 0) x = 0;
      if (x > ACTION_W) x = ACTION_W + (x - ACTION_W) * 0.2;
      fg.style.transform = `translateX(${x}px)`;
    }, { passive: false });

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

    fg.addEventListener('click', () => {
      if (decided && horizontal) return;
      if (isOpen()) { closeOpen(); return; }
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
    const st = { tipo: m.tipo };
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
      if (st.tipo === 'transferencia') {
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
        const tipoCat = st.tipo === 'ingreso' ? 'ingreso' : 'gasto';
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
      b.classList.toggle('active', b.dataset.tipo === st.tipo);
      b.addEventListener('click', () => {
        st.tipo = b.dataset.tipo;
        segBtns.forEach((x) => x.classList.toggle('active', x === b));
        renderDetails();
      });
    });
    renderDetails();

    sheet.querySelector('#close').addEventListener('click', closeModal);
    sheet.querySelector('#del').addEventListener('click', () => onDelete(m));
    sheet.querySelector('#edit-form').addEventListener('submit', (e) => onSubmit(e, m, st));

    openSheet();
  }

  // ---------- Hoja: abrir / cerrar ----------
  function openSheet() {
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
    todos = await getMovimientos();
    renderList();
  }

  async function onSubmit(e, m, st) {
    e.preventDefault();
    const msg = sheet.querySelector('#edit-msg');
    const save = sheet.querySelector('#save');
    msg.innerHTML = '';
    const mov = {
      fecha: sheet.querySelector('#fecha').value,
      tipo: st.tipo,
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
      msg.innerHTML = `<div class="msg error">${escapeHtml(err.message || 'No se pudo guardar.')}</div>`;
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
      msg.innerHTML = `<div class="msg error">${escapeHtml(err.message || 'No se pudo eliminar.')}</div>`;
    }
  }

  renderFilter();
  renderList();
}
