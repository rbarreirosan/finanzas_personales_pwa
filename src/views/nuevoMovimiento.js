import {
  getCuentas,
  getCategorias,
  sugerirCategoria,
  crearTransaccion,
} from '../lib/api.js';
import { today } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Formulario "Nuevo movimiento": inserta en transacciones respetando las
// validaciones del esquema y autosugiere categoría con fn_sugerir_categoria.
export function NuevoMovimientoView(params) {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar"><h1 class="large-title">Nuevo</h1></div>
    </header>
    <div class="screen-body"><div class="loading">Cargando cuentas y categorías…</div></div>
  `;

  init(el, params).catch((err) => {
    el.querySelector('.screen-body').innerHTML = `<div class="msg error">${escapeHtml(
      err.message || 'Error al cargar el formulario.'
    )}</div>`;
  });

  return el;
}

const cuentaOption = (c) =>
  `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`;

async function init(el, params) {
  const [cuentas, categorias] = await Promise.all([
    getCuentas(),
    getCategorias(),
  ]);

  const state = { tipo: 'gasto', categoria_id: '', tags: [] };
  const body = el.querySelector('.screen-body');

  body.innerHTML = `
    <form id="mov-form">
      <div id="mov-msg"></div>

      <div class="seg" id="tipo-seg" style="margin-bottom:14px">
        <button type="button" data-tipo="ingreso">Ingreso</button>
        <button type="button" data-tipo="gasto">Gasto</button>
        <button type="button" data-tipo="transferencia">Transferencia</button>
      </div>

      <div class="amount-card" style="margin-bottom:14px">
        <div class="amount-top">
          <div class="field" style="gap:6px">
            <span class="f-label">Monto</span>
            <div class="amount-input-wrap">
              <span class="sign">$</span>
              <input id="monto" class="amount-input t-gasto" type="number" step="0.01"
                     min="0.01" inputmode="decimal" placeholder="0.00" required />
            </div>
          </div>
          <div class="date-mini">
            <span class="f-label">Fecha</span>
            <input id="fecha" class="date-input" type="date" value="${today()}" required />
          </div>
        </div>
      </div>

      <div class="card" id="details"></div>

      <button class="btn btn-block" type="submit" id="save-btn" style="margin-top:16px">
        Guardar movimiento
      </button>
    </form>
  `;

  const form = body.querySelector('#mov-form');
  const msg = body.querySelector('#mov-msg');
  const segBtns = body.querySelectorAll('#tipo-seg button');
  const montoInp = body.querySelector('#monto');
  const details = body.querySelector('#details');
  const saveBtn = body.querySelector('#save-btn');

  // ---- render de la tarjeta de detalles según el tipo ----
  function renderDetails() {
    const tipoCat = state.tipo === 'ingreso' ? 'ingreso' : 'gasto';
    const cats = categorias.filter((c) => c.tipo === tipoCat);
    const catOpts =
      '<option value="">Selecciona…</option>' +
      cats
        .map(
          (c) =>
            `<option value="${c.id}">${escapeHtml(c.icono || '')} ${escapeHtml(
              c.nombre
            )}</option>`
        )
        .join('');

    if (state.tipo === 'transferencia') {
      details.innerHTML = `
        <div class="field">
          <span class="f-label">Cuenta origen</span>
          <select id="cuenta">${'<option value="">Selecciona…</option>' +
            cuentas.map(cuentaOption).join('')}</select>
        </div>
        <div class="arrow-sep">
          <div class="ln"></div><div class="node">↓</div><div class="ln"></div>
        </div>
        <div class="field">
          <span class="f-label">Cuenta destino</span>
          <select id="cuenta_destino" class="highlight">${'<option value="">Selecciona…</option>' +
            cuentas.map(cuentaOption).join('')}</select>
        </div>
        <div class="note">Las transferencias no usan categoría: no afectan ingresos ni gastos del mes.</div>
        <div class="field">
          <span class="f-label">Descripción</span>
          <input id="descripcion" type="text" placeholder="Opcional" />
        </div>
        ${tagsFieldHtml()}
      `;
    } else {
      details.innerHTML = `
        <div class="field">
          <span class="f-label">Cuenta origen</span>
          <select id="cuenta">${'<option value="">Selecciona…</option>' +
            cuentas.map(cuentaOption).join('')}</select>
        </div>
        <div class="field">
          <span class="f-label">Categoría</span>
          <select id="categoria">${catOpts}</select>
          <span class="suggestion" id="sugerencia" hidden></span>
        </div>
        <div class="field">
          <span class="f-label">Comercio</span>
          <input id="comercio" type="text" placeholder="Ej. Oxxo, Amazon…" />
        </div>
        <div class="field">
          <span class="f-label">Descripción</span>
          <input id="descripcion" type="text" placeholder="Opcional" />
        </div>
        ${tagsFieldHtml()}
      `;
      bindCategoriaEnGasto();
    }
    bindTags();
  }

  function tagsFieldHtml() {
    return `
      <div class="field">
        <span class="f-label">Etiquetas</span>
        <div class="chips" id="chips"></div>
      </div>
    `;
  }

  function renderChips() {
    const chips = body.querySelector('#chips');
    if (!chips) return;
    chips.innerHTML =
      state.tags
        .map(
          (t, i) =>
            `<span class="chip">${escapeHtml(t)}<span class="x" data-i="${i}">✕</span></span>`
        )
        .join('') +
      `<input class="chip-input" id="chip-input" type="text" placeholder="+ Agregar" />`;

    chips.querySelectorAll('.x').forEach((x) =>
      x.addEventListener('click', () => {
        state.tags.splice(Number(x.dataset.i), 1);
        renderChips();
      })
    );
    const input = chips.querySelector('#chip-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(input.value);
        input.value = '';
      }
    });
    input.addEventListener('blur', () => {
      addTag(input.value);
      input.value = '';
    });
  }

  function addTag(raw) {
    const t = (raw || '').trim().replace(/,$/, '');
    if (t && !state.tags.includes(t)) {
      state.tags.push(t);
      renderChips();
    }
  }

  function bindTags() {
    renderChips();
  }

  // ---- autosugerencia de categoría (fn_sugerir_categoria) con debounce ----
  let debounceTimer = null;
  function bindCategoriaEnGasto() {
    const categoriaSel = body.querySelector('#categoria');
    const comercioInp = body.querySelector('#comercio');
    const sugerenciaEl = body.querySelector('#sugerencia');

    categoriaSel.value =
      state.categoria_id &&
      [...categoriaSel.options].some((o) => o.value === state.categoria_id)
        ? state.categoria_id
        : '';
    categoriaSel.addEventListener('change', (e) => {
      state.categoria_id = e.target.value;
    });

    function trySuggest(campo, texto) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const catId = await sugerirCategoria(texto, campo, state.tipo);
          if (!catId) {
            sugerenciaEl.hidden = true;
            return;
          }
          const cat = categorias.find((c) => c.id === catId);
          if (!cat) return;
          if (!categoriaSel.value) {
            categoriaSel.value = catId;
            state.categoria_id = catId;
          }
          sugerenciaEl.hidden = false;
          sugerenciaEl.textContent = `Sugerido: ${cat.icono || ''} ${cat.nombre}`;
        } catch {
          sugerenciaEl.hidden = true;
        }
      }, 350);
    }

    comercioInp.addEventListener('input', (e) =>
      trySuggest('comercio', e.target.value)
    );
    const descripcionInp = body.querySelector('#descripcion');
    descripcionInp.addEventListener('input', (e) =>
      trySuggest('descripcion', e.target.value)
    );
  }

  // ---- segmented control ----
  function applyTipo(tipo) {
    state.tipo = tipo;
    if (tipo === 'transferencia') state.categoria_id = '';
    segBtns.forEach((b) => b.classList.toggle('active', b.dataset.tipo === tipo));
    montoInp.className = `amount-input t-${tipo}`;
    renderDetails();
  }

  segBtns.forEach((b) =>
    b.addEventListener('click', () => applyTipo(b.dataset.tipo))
  );

  // ---- Deep link (Atajos de iPhone): #/nuevo?tipo=gasto&monto=140.12&comercio=Oxxo
  const TIPOS_OK = ['ingreso', 'gasto', 'transferencia'];
  const qpTipo = params?.get('tipo');
  const qpMonto = params?.get('monto');
  const qpComercio = params?.get('comercio');
  const qpDescripcion = params?.get('descripcion');

  applyTipo(TIPOS_OK.includes(qpTipo) ? qpTipo : 'gasto');

  if (qpMonto != null) {
    const m = Number(String(qpMonto).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(m) && m > 0) montoInp.value = String(m);
  }
  const comercioInp = body.querySelector('#comercio');
  if (comercioInp && qpComercio) {
    comercioInp.value = qpComercio;
    comercioInp.dispatchEvent(new Event('input')); // dispara la autosugerencia
  }
  const descInp = body.querySelector('#descripcion');
  if (descInp && qpDescripcion) descInp.value = qpDescripcion;

  // Enfoca el monto para escribir de inmediato al llegar desde el Atajo.
  if (montoInp.value) montoInp.select?.();
  montoInp.focus({ preventScroll: true });

  // ---- envío ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';

    const mov = {
      fecha: body.querySelector('#fecha').value,
      tipo: state.tipo,
      monto: montoInp.value,
      cuenta_id: body.querySelector('#cuenta')?.value || null,
      cuenta_destino_id: body.querySelector('#cuenta_destino')?.value || null,
      categoria_id: body.querySelector('#categoria')?.value || null,
      comercio: body.querySelector('#comercio')?.value || '',
      descripcion: body.querySelector('#descripcion')?.value || '',
      etiquetas: state.tags.join(', '),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    try {
      await crearTransaccion(mov);
      msg.innerHTML = '<div class="msg ok">✅ Movimiento guardado.</div>';
      montoInp.value = '';
      body.querySelector('#fecha').value = today();
      state.categoria_id = '';
      state.tags = [];
      applyTipo(state.tipo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${escapeHtml(
        err.message || 'No se pudo guardar el movimiento.'
      )}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar movimiento';
    }
  });
}
