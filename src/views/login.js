import { signIn, signUp } from '../lib/auth.js';

// Pantalla de autenticacion (email + password). Devuelve un elemento DOM.
export function LoginView() {
  const el = document.createElement('div');
  el.className = 'auth-wrap';
  let mode = 'signin'; // 'signin' | 'signup'

  function render() {
    el.innerHTML = `
      <div class="brand">
        <div class="logo">💰</div>
        <h1>Finanzas Personales</h1>
      </div>
      <form id="auth-form" class="card">
        <div id="auth-msg"></div>
        <div>
          <label for="email">Correo</label>
          <input id="email" type="email" autocomplete="email" required
                 inputmode="email" placeholder="tucorreo@ejemplo.com" />
        </div>
        <div>
          <label for="password">Contraseña</label>
          <input id="password" type="password"
                 autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"
                 required minlength="6" placeholder="••••••••" />
        </div>
        <button class="btn" type="submit" id="submit-btn">
          ${mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <p class="center-muted">
          ${
            mode === 'signin'
              ? '¿No tienes cuenta? '
              : '¿Ya tienes cuenta? '
          }
          <button type="button" class="link-btn" id="toggle-mode">
            ${mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </form>
    `;

    const form = el.querySelector('#auth-form');
    const msg = el.querySelector('#auth-msg');
    const btn = el.querySelector('#submit-btn');

    el.querySelector('#toggle-mode').addEventListener('click', () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.innerHTML = '';
      const email = el.querySelector('#email').value;
      const password = el.querySelector('#password').value;
      btn.disabled = true;
      btn.textContent = 'Procesando…';
      try {
        if (mode === 'signin') {
          await signIn(email, password);
          // onAuthChange en main.js re-renderiza la app.
        } else {
          const { session } = await signUp(email, password);
          if (!session) {
            msg.innerHTML =
              '<div class="msg ok">Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.</div>';
            mode = 'signin';
            // Re-render manteniendo el mensaje visible brevemente.
            setTimeout(render, 3500);
          }
        }
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${escapeHtml(
          err.message || 'No se pudo autenticar.'
        )}</div>`;
        btn.disabled = false;
        btn.textContent = mode === 'signin' ? 'Entrar' : 'Crear cuenta';
      }
    });
  }

  render();
  return el;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
