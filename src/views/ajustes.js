import { isSupported, isEnabled, enable, disable } from '../lib/faceid.js';
import { escapeHtml } from '../lib/dom.js';

// Hub de ajustes: Categorías, Presupuestos, Meta de ahorro y Seguridad (Face ID).
export function AjustesView() {
  const el = document.createElement('div');
  el.className = 'screen';

  const faceRow = isSupported()
    ? `
      <p class="section-label" style="margin-top:10px">Seguridad</p>
      <div class="glass-row space">
        <div class="grow">
          <div class="gr-title">Entrar con Face ID</div>
          <div class="gr-sub">Bloquea la app y ábrela con Face ID. Tu contraseña sigue como respaldo.</div>
        </div>
        <label class="switch">
          <input id="faceid-toggle" type="checkbox" ${isEnabled() ? 'checked' : ''} />
          <span class="track"></span>
        </label>
      </div>
      <div id="faceid-msg"></div>`
    : '';

  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/dashboard" aria-label="Volver">‹</a>
          <h1 class="large-title">Ajustes</h1>
        </div>
      </div>
    </header>
    <div class="screen-body">
      <a class="hub-item" href="#/categorias">
        <span class="emoji">🏷️</span>
        <span class="grow">
          <span class="h-title">Categorías</span>
          <span class="h-sub">Ingresos y gastos (esencial / discrecional)</span>
        </span>
        <span class="chev">›</span>
      </a>
      <a class="hub-item" href="#/presupuestos">
        <span class="emoji">🎯</span>
        <span class="grow">
          <span class="h-title">Presupuestos</span>
          <span class="h-sub">Límites por categoría del mes</span>
        </span>
        <span class="chev">›</span>
      </a>
      <a class="hub-item" href="#/meta">
        <span class="emoji">💰</span>
        <span class="grow">
          <span class="h-title">Meta de ahorro</span>
          <span class="h-sub">Cuánto quieres ahorrar cada mes</span>
        </span>
        <span class="chev">›</span>
      </a>

      ${faceRow}

      <button class="btn-danger" data-action="logout" style="margin-top:14px">
        Cerrar sesión
      </button>
    </div>
  `;

  const toggle = el.querySelector('#faceid-toggle');
  if (toggle) {
    const msg = el.querySelector('#faceid-msg');
    toggle.addEventListener('change', async () => {
      msg.innerHTML = '';
      if (toggle.checked) {
        toggle.disabled = true;
        try {
          await enable();
          msg.innerHTML =
            '<div class="msg ok">✅ Face ID activado. La próxima vez que abras la app te lo pedirá.</div>';
        } catch (err) {
          toggle.checked = false;
          msg.innerHTML = `<div class="msg error">${escapeHtml(
            err.message || 'No se pudo activar Face ID.'
          )}</div>`;
        } finally {
          toggle.disabled = false;
        }
      } else {
        disable();
        msg.innerHTML = '<div class="msg ok">Face ID desactivado.</div>';
      }
    });
  }

  return el;
}
