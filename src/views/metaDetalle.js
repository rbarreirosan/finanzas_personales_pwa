import {
  listMetas,
  listMetaItems,
  getCuentas,
  getCategorias,
  crearMetaItem,
  actualizarMetaItem,
  eliminarMetaItem,
  crearTransaccion,
  eliminarTransaccion,
} from '../lib/api.js';
import {
  totalMeta,
  invertidoMeta,
  pctMeta,
  montoItem,
} from '../lib/metasCalc.js';
import { money, money0, today, dayLabel } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

const PRIO_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PRIO_RANK = { alta: 0, media: 1, baja: 2 };

const URL_RE = /(https?:\/\/[^\s]+)/g;

// Primera URL http(s) dentro de un texto (o null).
function primerEnlace(texto) {
  const m = String(texto || '').match(URL_RE);
  return m ? m[0] : null;
}

// Convierte URLs de un texto en enlaces clickeables (escapando el resto).
function linkify(texto) {
  const s = String(texto || '');
  let out = '';
  let last = 0;
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(s))) {
    if (m.index > last) out += escapeHtml(s.slice(last, m.index));
    const url = m[0];
    out += `<a href="${escapeHtml(
      url
    )}" target="_blank" rel="noopener noreferrer" class="nota-link">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  if (last < s.length) out += escapeHtml(s.slice(last));
  return out;
}

// Detalle de una meta: resumen + ítems (pendientes/comprados) + hojas.
export function MetaDetalleView(params) {
  const id = params?.get('id') || null;
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/metas" aria-label="Volver">‹</a>
          <div>
            <h1 class="large-title" id="md-title" style="font-size:24px">Meta</h1>
            <div class="subtitle" id="md-sub"></div>
          </div>
        </div>
      </div>
    </header>
    <div class="screen-body" id="md-body"><div class="loading">Cargando…</div></div>
    <div class="modal-backdrop" id="md-modal" hidden><div class="sheet" id="md-sheet"></div></div>
  `;
  init(el, id).catch((err) => {
    el.querySelector('#md-body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || err
    )}</div>`;
  });
  return el;
}

async function init(el, id) {
  const body = el.querySelector('#md-body');
  const titleEl = el.querySelector('#md-title');
  const subEl = el.querySelector('#md-sub');
  const modal = el.querySelector('#md-modal');
  const sheet = el.querySelector('#md-sheet');

  const [metas, cuentas, categorias] = await Promise.all([
    listMetas(),
    getCuentas(),
    getCategorias(),
  ]);
  const meta = metas.find((m) => m.id === id);
  if (!meta) {
    body.innerHTML = '<div class="msg error">No se encontró la meta.</div>';
    return;
  }
  const catsGasto = categorias.filter((c) => c.tipo === 'gasto');
  let items = [];

  async function refresh() {
    const all = await listMetaItems();
    items = all.filter((it) => it.meta_id === id);
    render();
  }

  function render() {
    titleEl.textContent = `${meta.emoji || '🎯'}  ${meta.nombre}`;
    const nComprados = items.filter((i) => i.comprado).length;
    subEl.textContent = `${items.length} ${
      items.length === 1 ? 'ítem' : 'ítems'
    } · ${nComprados} comprados`;

    const t = totalMeta(items);
    const inv = invertidoMeta(items);
    const p = pctMeta(items);
    const falta = Math.max(0, t - inv);
    const fechaBadge = meta.fecha_objetivo
      ? `Meta: ${dayLabel(meta.fecha_objetivo)}`
      : 'Sin fecha';

    const pend = items
      .filter((i) => !i.comprado)
      .sort(
        (a, b) =>
          (PRIO_RANK[a.prioridad] ?? 1) - (PRIO_RANK[b.prioridad] ?? 1) ||
          String(a.created_at).localeCompare(String(b.created_at))
      );
    const comp = items.filter((i) => i.comprado);

    const linkBadge = (it) =>
      primerEnlace(it.nota) ? '<span class="mi-link" aria-label="Tiene enlace">🔗</span>' : '';

    const pendHtml = pend
      .map((it) => {
        const prio = it.prioridad || 'media';
        return `
        <div class="meta-item pend">
          <button class="mi-check prio-${prio}" data-buy="${it.id}" aria-label="Marcar como comprado"></button>
          <button class="mi-open" data-open="${it.id}">
            <div class="mi-body">
              <div class="mi-name">${escapeHtml(it.nombre)} ${linkBadge(it)}</div>
              <div class="mi-meta prio-${prio}"><span class="prio-dot"></span>Prioridad ${
          PRIO_LABEL[prio] || 'Media'
        }</div>
            </div>
            <div class="mi-price">${money(montoItem(it))}</div>
          </button>
        </div>`;
      })
      .join('');

    const compHtml = comp
      .map(
        (it) => `
        <div class="meta-item done">
          <button class="mi-check done" data-unbuy="${it.id}" aria-label="Desmarcar">✓</button>
          <button class="mi-open" data-open="${it.id}">
            <div class="mi-body">
              <div class="mi-name done">${escapeHtml(it.nombre)} ${linkBadge(it)}</div>
              <div class="mi-meta done">Comprado el ${
                it.fecha_compra ? escapeHtml(dayLabel(it.fecha_compra)) : 'hoy'
              }</div>
            </div>
            <div class="mi-price done">${money(montoItem(it))}</div>
          </button>
        </div>`
      )
      .join('');

    body.innerHTML = `
      <div class="meta-hero">
        <div class="mh-row">
          <span class="mh-label">Cumplido</span>
          <span class="mh-badge">${escapeHtml(fechaBadge)}</span>
        </div>
        <div class="mh-pct tnum">${p}%</div>
        <div class="mh-track"><div class="mh-fill" style="width:${Math.max(2, p)}%"></div></div>
        <div class="mh-div"></div>
        <div class="mh-foot">
          <span class="mh-inv tnum">${money0(inv)} <span class="mh-total">/ ${money0(t)}</span></span>
          <span class="mh-falta tnum">Falta ${money0(falta)}</span>
        </div>
      </div>

      <div class="meta-actions">
        <a class="ma-btn ghost" href="#/meta-form?id=${meta.id}">Editar meta</a>
        <button class="ma-btn soft" data-additem>+ Agregar</button>
      </div>

      ${
        pend.length
          ? `<p class="section-label" style="margin-top:22px">Pendientes · ${pend.length}</p>
             <div class="meta-items">${pendHtml}</div>`
          : ''
      }
      ${
        comp.length
          ? `<p class="section-label" style="margin-top:22px">Comprados · ${comp.length}</p>
             <div class="meta-items">${compHtml}</div>`
          : ''
      }
      ${
        items.length === 0
          ? '<div class="empty" style="margin-top:18px">Agrega los ítems que quieres comprar para esta meta.</div>'
          : ''
      }

      <button class="meta-add-dashed" data-additem style="margin-top:14px">+ Agregar ítem</button>
    `;

    body.querySelectorAll('[data-additem]').forEach((b) =>
      b.addEventListener('click', () => openItemSheet())
    );
    body.querySelectorAll('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = items.find((x) => x.id === b.dataset.buy);
        if (it) openBuySheet(it);
      })
    );
    body.querySelectorAll('[data-unbuy]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = items.find((x) => x.id === b.dataset.unbuy);
        if (it) unmark(it);
      })
    );
    body.querySelectorAll('[data-open]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = items.find((x) => x.id === b.dataset.open);
        if (it) openItemDetail(it);
      })
    );
  }

  // ---------- Hoja: detalle del ítem (nota con enlace, editar, eliminar) ----------
  function openItemDetail(it) {
    const enlace = primerEnlace(it.nota);
    const estado = it.comprado
      ? `Comprado${it.fecha_compra ? ' el ' + dayLabel(it.fecha_compra) : ''}`
      : 'Pendiente';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar"><h2>${escapeHtml(it.nombre)}</h2>
        <button class="sheet-close" id="d-close" aria-label="Cerrar">✕</button></div>

      <div class="panel" style="margin-top:6px">
        <div class="row"><span class="r-label">Precio ${
          it.comprado && it.precio_real != null ? 'pagado' : 'estimado'
        }</span><span class="r-value tnum">${money(montoItem(it))}</span></div>
        <div class="row"><span class="r-label">Prioridad</span><span class="r-value prio-${
          it.prioridad || 'media'
        }">${PRIO_LABEL[it.prioridad] || 'Media'}</span></div>
        <div class="row"><span class="r-label">Estado</span><span class="r-value">${escapeHtml(
          estado
        )}</span></div>
      </div>

      ${
        it.nota
          ? `<p class="section-label" style="margin-top:16px">Nota</p>
             <div class="item-nota">${linkify(it.nota)}</div>`
          : '<div class="gr-sub" style="margin-top:14px">Este ítem no tiene nota. Toca “Editar” para agregar una nota o el enlace del producto.</div>'
      }

      ${
        enlace
          ? `<a class="btn btn-block meta-btn" href="${escapeHtml(
              enlace
            )}" target="_blank" rel="noopener noreferrer" style="margin-top:14px;display:flex;align-items:center;justify-content:center;text-decoration:none">🔗 Abrir enlace del producto</a>`
          : ''
      }

      <div class="btn-actions" style="margin-top:14px">
        <button class="btn-danger" id="d-del">Eliminar</button>
        <button class="btn" id="d-edit">Editar ítem</button>
      </div>
      ${
        !it.comprado
          ? '<button class="btn btn-block meta-btn" id="d-buy" style="margin-top:10px">Marcar como comprado</button>'
          : ''
      }
    `;
    sheet.querySelector('#d-close').addEventListener('click', closeSheet);
    sheet.querySelector('#d-edit').addEventListener('click', () => openItemSheet(it));
    sheet.querySelector('#d-buy')?.addEventListener('click', () => openBuySheet(it));
    sheet.querySelector('#d-del').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar "${it.nombre}" de esta meta?`)) return;
      try {
        await eliminarMetaItem(it.id);
        closeSheet();
        await refresh();
      } catch (err) {
        alert(err.message || 'No se pudo eliminar.');
      }
    });
    openSheet();
  }

  // ---------- Hoja: agregar / editar ítem ----------
  function openItemSheet(existing = null) {
    const editando = Boolean(existing);
    const st = { prioridad: existing?.prioridad || 'media' };
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar"><h2>${editando ? 'Editar ítem' : 'Agregar ítem'}</h2>
        <button class="sheet-close" id="s-close" aria-label="Cerrar">✕</button></div>
      <div id="s-msg"></div>
      <div class="field">
        <span class="f-label">Nombre del ítem</span>
        <input id="s-nombre" type="text" placeholder="Ej. Escáner OBD2" value="${escapeHtml(
          existing?.nombre || ''
        )}" />
      </div>
      <div class="field">
        <span class="f-label">Precio estimado</span>
        <div class="amount-input-wrap"><span class="sign">$</span>
          <input id="s-precio" class="amount-input t-ingreso" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00" value="${
            existing ? Number(existing.precio_estimado) : ''
          }" /></div>
      </div>
      <div class="field">
        <span class="f-label">Prioridad</span>
        <div class="seg" id="s-prio">
          <button type="button" data-p="alta">Alta</button>
          <button type="button" data-p="media">Media</button>
          <button type="button" data-p="baja">Baja</button>
        </div>
      </div>
      <div class="field">
        <span class="f-label">Nota o enlace <span class="opt">(opcional)</span></span>
        <input id="s-nota" type="text" placeholder="Pega aquí el link del producto o una nota" value="${escapeHtml(
          existing?.nota || ''
        )}" />
      </div>
      <button class="btn btn-block meta-btn" id="s-save" style="margin-top:6px">${
        editando ? 'Guardar cambios' : 'Guardar ítem'
      }</button>
    `;
    const syncPrio = () =>
      sheet
        .querySelectorAll('#s-prio button')
        .forEach((x) => x.classList.toggle('active', x.dataset.p === st.prioridad));
    sheet.querySelectorAll('#s-prio button').forEach((b) =>
      b.addEventListener('click', () => {
        st.prioridad = b.dataset.p;
        syncPrio();
      })
    );
    syncPrio();
    sheet.querySelector('#s-close').addEventListener('click', closeSheet);
    sheet.querySelector('#s-save').addEventListener('click', async () => {
      const msg = sheet.querySelector('#s-msg');
      msg.innerHTML = '';
      const datos = {
        nombre: sheet.querySelector('#s-nombre').value,
        precio_estimado: sheet.querySelector('#s-precio').value,
        prioridad: st.prioridad,
        nota: sheet.querySelector('#s-nota').value,
      };
      if (!datos.nombre.trim()) {
        msg.innerHTML = '<div class="msg error">Ponle un nombre al ítem.</div>';
        return;
      }
      try {
        if (editando) await actualizarMetaItem(existing.id, datos);
        else await crearMetaItem({ meta_id: id, ...datos });
        closeSheet();
        await refresh();
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(err.message || 'No se pudo guardar.')}</div>`;
      }
    });
    openSheet();
    sheet.querySelector('#s-nombre').focus();
  }

  // ---------- Hoja: marcar como comprado ----------
  function openBuySheet(it) {
    const st = {
      cuenta: cuentas[0]?.id || '',
      categoria: catsGasto[0]?.id || '',
      gasto: true,
    };
    const cuentaOpts = cuentas
      .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
      .join('');
    const catOpts =
      '<option value="">Selecciona…</option>' +
      catsGasto
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === st.categoria ? ' selected' : ''}>${escapeHtml(
              c.icono || ''
            )} ${escapeHtml(c.nombre)}</option>`
        )
        .join('');

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-titlebar"><h2>Marcar como comprado</h2>
        <button class="sheet-close" id="b-close" aria-label="Cerrar">✕</button></div>
      <div class="gr-sub" style="margin:-6px 0 14px">${escapeHtml(it.nombre)}</div>
      <div id="b-msg"></div>
      <div class="field">
        <span class="f-label">Precio real pagado</span>
        <div class="amount-input-wrap"><span class="sign">$</span>
          <input id="b-precio" class="amount-input t-gasto" type="number" step="0.01" min="0" inputmode="decimal"
                 value="${Number(it.precio_estimado)}" /></div>
        <span class="suggestion" style="visibility:visible">Estimado: ${money(it.precio_estimado)}</span>
      </div>
      <div class="field">
        <span class="f-label">Fecha de compra</span>
        <input id="b-fecha" type="date" value="${today()}" />
      </div>
      <div class="field">
        <span class="f-label">Cuenta origen</span>
        <select id="b-cuenta">${cuentaOpts}</select>
      </div>
      <div class="field" id="b-cat-wrap">
        <span class="f-label">Categoría del gasto</span>
        <select id="b-categoria">${catOpts}</select>
      </div>
      <div class="switch-row">
        <div class="grow">
          <div class="gr-title">Registrar también como gasto</div>
          <div class="gr-sub">Crea el movimiento en tus cuentas y presupuesto.</div>
        </div>
        <label class="switch">
          <input id="b-gasto" type="checkbox" checked />
          <span class="track"></span>
        </label>
      </div>
      <button class="btn btn-block meta-btn" id="b-confirm" style="margin-top:14px">Confirmar compra</button>
      <div class="resumen-note" style="text-align:center;margin-top:10px">Si el precio real cambia, el total de la meta se ajusta solo.</div>
    `;

    if (!cuentas.length) {
      sheet.querySelector('#b-confirm').disabled = true;
      sheet.querySelector('#b-msg').innerHTML =
        '<div class="msg error">Primero crea una cuenta en la pestaña Cuentas.</div>';
    }

    const gastoChk = sheet.querySelector('#b-gasto');
    const catWrap = sheet.querySelector('#b-cat-wrap');
    const syncGasto = () => {
      catWrap.hidden = !gastoChk.checked;
    };
    gastoChk.addEventListener('change', syncGasto);
    syncGasto();

    sheet.querySelector('#b-close').addEventListener('click', closeSheet);
    sheet.querySelector('#b-confirm').addEventListener('click', () =>
      confirmarCompra(it)
    );
    openSheet();
  }

  async function confirmarCompra(it) {
    const msg = sheet.querySelector('#b-msg');
    const btn = sheet.querySelector('#b-confirm');
    msg.innerHTML = '';
    const precio = Number(sheet.querySelector('#b-precio').value);
    if (!Number.isFinite(precio) || precio <= 0) {
      msg.innerHTML = '<div class="msg error">Escribe el precio real pagado.</div>';
      return;
    }
    const fecha = sheet.querySelector('#b-fecha').value || today();
    const cuenta_id = sheet.querySelector('#b-cuenta').value;
    const registrarGasto = sheet.querySelector('#b-gasto').checked;
    const categoria_id = sheet.querySelector('#b-categoria')?.value || '';

    if (registrarGasto && !categoria_id) {
      msg.innerHTML = '<div class="msg error">Elige una categoría para el gasto.</div>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      let gasto_id = null;
      if (registrarGasto) {
        // Mismo formato/lógica que la pantalla "Nuevo".
        const gasto = await crearTransaccion({
          fecha,
          tipo: 'gasto',
          monto: precio,
          cuenta_id,
          categoria_id,
          comercio: it.nombre,
          descripcion: `Meta: ${meta.nombre}`,
        });
        gasto_id = gasto.id;
      }
      await actualizarMetaItem(it.id, {
        comprado: true,
        precio_real: precio,
        fecha_compra: fecha,
        gasto_id,
      });
      closeSheet();
      await refresh();
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo registrar.'
      )}</div>`;
      btn.disabled = false;
      btn.textContent = 'Confirmar compra';
    }
  }

  // ---------- Desmarcar comprado ----------
  async function unmark(it) {
    let borrarGasto = false;
    if (it.gasto_id) {
      borrarGasto = confirm(
        `Vas a desmarcar "${it.nombre}", que tiene un gasto ligado de ${money(
          montoItem(it)
        )}.\n\nAceptar: borrar también ese gasto.\nCancelar: conservar el gasto (solo se desmarca el ítem).`
      );
    }
    try {
      if (it.gasto_id && borrarGasto) {
        await eliminarTransaccion(it.gasto_id);
      }
      await actualizarMetaItem(it.id, {
        comprado: false,
        precio_real: null,
        fecha_compra: null,
        gasto_id: null,
      });
      await refresh();
    } catch (err) {
      alert(err.message || 'No se pudo desmarcar.');
    }
  }

  // ---------- Hoja: abrir / cerrar ----------
  function openSheet() {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    sheet.scrollTop = 0;
  }
  function closeSheet() {
    modal.hidden = true;
    sheet.innerHTML = '';
    document.body.classList.remove('modal-open');
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSheet();
  });

  await refresh();
}
