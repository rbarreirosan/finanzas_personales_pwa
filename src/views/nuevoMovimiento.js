import {
  getCuentas,
  getCategorias,
  sugerirCategoria,
  crearTransaccion,
} from '../lib/api.js';
import { today } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Formulario "Nuevo movimiento": inserta en transacciones respetando las
// validaciones del esquema y autosugiere categoria con fn_sugerir_categoria.
export function NuevoMovimientoView() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="loading">Cargando cuentas y categorías…</div>`;

  init(el).catch((err) => {
    el.innerHTML = `<div class="msg error">${escapeHtml(
      err.message || 'Error al cargar el formulario.'
    )}</div>`;
  });

  return el;
}

async function init(el) {
  const [cuentas, categorias] = await Promise.all([
    getCuentas(),
    getCategorias(),
  ]);

  const state = { tipo: 'gasto', categoria_id: '' };

  el.innerHTML = `
    <p class="section-title">Nuevo movimiento</p>
    <form id="mov-form" class="card">
      <div id="mov-msg"></div>

      <div class="seg" id="tipo-seg">
        <button type="button" data-tipo="ingreso">Ingreso</button>
        <button type="button" data-tipo="gasto" class="active">Gasto</button>
        <button type="button" data-tipo="transferencia">Transferencia</button>
      </div>

      <div>
        <label for="fecha">Fecha</label>
        <input id="fecha" type="date" value="${today()}" required />
      </div>

      <div>
        <label for="monto">Monto</label>
        <input id="monto" type="number" step="0.01" min="0.01" inputmode="decimal"
               placeholder="0.00" required />
      </div>

      <div>
        <label for="cuenta">Cuenta origen</label>
        <select id="cuenta" required>
          <option value="">Selecciona…</option>
          ${cuentas
            .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
            .join('')}
        </select>
      </div>

      <div id="destino-wrap" hidden>
        <label for="cuenta_destino">Cuenta destino</label>
        <select id="cuenta_destino">
          <option value="">Selecciona…</option>
          ${cuentas
            .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
            .join('')}
        </select>
      </div>

      <div id="categoria-wrap">
        <label for="categoria">Categoría</label>
        <select id="categoria">
          <option value="">Selecciona…</option>
        </select>
        <p class="suggestion" id="sugerencia" hidden></p>
      </div>

      <div>
        <label for="comercio">Comercio</label>
        <input id="comercio" type="text" placeholder="Ej. Oxxo, Amazon…" />
      </div>

      <div>
        <label for="descripcion">Descripción</label>
        <input id="descripcion" type="text" placeholder="Opcional" />
      </div>

      <div>
        <label for="etiquetas">Etiquetas</label>
        <input id="etiquetas" type="text" placeholder="Opcional (separadas por coma)" />
      </div>

      <button class="btn" type="submit" id="save-btn">Guardar movimiento</button>
    </form>
  `;

  const form = el.querySelector('#mov-form');
  const msg = el.querySelector('#mov-msg');
  const segBtns = el.querySelectorAll('#tipo-seg button');
  const destinoWrap = el.querySelector('#destino-wrap');
  const categoriaWrap = el.querySelector('#categoria-wrap');
  const categoriaSel = el.querySelector('#categoria');
  const cuentaSel = el.querySelector('#cuenta');
  const destinoSel = el.querySelector('#cuenta_destino');
  const comercioInp = el.querySelector('#comercio');
  const descripcionInp = el.querySelector('#descripcion');
  const sugerenciaEl = el.querySelector('#sugerencia');
  const saveBtn = el.querySelector('#save-btn');

  function fillCategorias() {
    const tipoCat = state.tipo === 'ingreso' ? 'ingreso' : 'gasto';
    const opts = categorias.filter((c) => c.tipo === tipoCat);
    categoriaSel.innerHTML =
      '<option value="">Selecciona…</option>' +
      opts
        .map(
          (c) =>
            `<option value="${c.id}">${escapeHtml(c.icono || '')} ${escapeHtml(
              c.nombre
            )}</option>`
        )
        .join('');
    categoriaSel.value = state.categoria_id && opts.some((c) => c.id === state.categoria_id)
      ? state.categoria_id
      : '';
  }

  function applyTipo(tipo) {
    state.tipo = tipo;
    segBtns.forEach((b) => b.classList.toggle('active', b.dataset.tipo === tipo));
    const esTransfer = tipo === 'transferencia';
    destinoWrap.hidden = !esTransfer;
    categoriaWrap.hidden = esTransfer;
    if (esTransfer) {
      state.categoria_id = '';
    } else {
      fillCategorias();
    }
    sugerenciaEl.hidden = true;
  }

  segBtns.forEach((b) =>
    b.addEventListener('click', () => applyTipo(b.dataset.tipo))
  );

  // --- Autosugerencia de categoria (fn_sugerir_categoria), con debounce ---
  let debounceTimer = null;
  async function trySuggest(campo, texto) {
    if (state.tipo === 'transferencia') return;
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
        // Solo autoselecciona si el usuario aun no eligio manualmente.
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
  descripcionInp.addEventListener('input', (e) =>
    trySuggest('descripcion', e.target.value)
  );
  categoriaSel.addEventListener('change', (e) => {
    state.categoria_id = e.target.value;
  });

  applyTipo('gasto');

  // --- Envio ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';

    const mov = {
      fecha: el.querySelector('#fecha').value,
      tipo: state.tipo,
      monto: el.querySelector('#monto').value,
      cuenta_id: cuentaSel.value || null,
      cuenta_destino_id: destinoSel.value || null,
      categoria_id: categoriaSel.value || null,
      comercio: comercioInp.value,
      descripcion: descripcionInp.value,
      etiquetas: el.querySelector('#etiquetas').value,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    try {
      await crearTransaccion(mov);
      msg.innerHTML = '<div class="msg ok">✅ Movimiento guardado.</div>';
      form.reset();
      el.querySelector('#fecha').value = today();
      state.categoria_id = '';
      applyTipo(state.tipo);
      msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
