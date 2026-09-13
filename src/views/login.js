import { signIn, signUp } from '../lib/auth.js';
import { escapeHtml } from '../lib/dom.js';

// Pantalla de autenticación (email + password) — estilo Liquid Glass.
export function LoginView() {
  const el = document.createElement('div');
  el.className = 'auth';
  let mode = 'signin'; // 'signin' | 'signup'
  let showPw = false;

  function render() {
    el.innerHTML = `
      <div class="brand">
        <div class="logo">$</div>
        <h1>Finanzas Personales</h1>
        <div class="tagline">Tu dinero, con claridad</div>
      </div>

      <form id="auth-form" class="auth-card">
        <div id="auth-msg"></div>

        <div class="field">
          <label for="email">Correo</label>
          <input id="email" type="email" autocomplete="email" required
                 inputmode="email" placeholder="tucorreo@ejemplo.com" />
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <div class="pw-wrap">
            <input id="password" type="${showPw ? 'text' : 'password'}"
                   autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"
                   required minlength="6" placeholder="••••••••" />
            <button type="button" class="pw-toggle" id="pw-toggle">${
              showPw ? 'Ocultar' : 'Mostrar'
            }</button>
          </div>
        </div>

        ${
          mode === 'signin'
            ? '<div style="text-align:right"><span class="link">¿Olvidaste tu contraseña?</span></div>'
            : ''
        }

        <button class="btn" type="submit" id="submit-btn">
          ${mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <div class="auth-foot">
        ${mode === 'signin' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
        <button type="button" class="link-btn" id="toggle-mode">
          ${mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
        </button>
      </div>
    `;

    const form = el.querySelector('#auth-form');
    const msg = el.querySelector('#auth-msg');
    const btn = el.querySelector('#submit-btn');

    el.querySelector('#pw-toggle').addEventListener('click', () => {
      showPw = !showPw;
      const pw = el.querySelector('#password');
      const val = pw.value;
      render();
      const pw2 = el.querySelector('#password');
      pw2.value = val;
      pw2.focus();
    });

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
          // onAuthChange (main.js) re-renderiza la app.
        } else {
          const { session } = await signUp(email, password);
          if (!session) {
            msg.innerHTML =
              '<div class="msg ok">Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.</div>';
            mode = 'signin';
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
