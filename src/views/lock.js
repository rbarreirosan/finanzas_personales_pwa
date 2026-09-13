import { verify } from '../lib/faceid.js';

// Pantalla de bloqueo: Face ID para entrar, con respaldo de "Usar contraseña".
export function LockView({ onUnlock, onPassword }) {
  const el = document.createElement('div');
  el.className = 'auth';
  el.innerHTML = `
    <div class="brand">
      <div class="logo">$</div>
      <h1>Finanzas Personales</h1>
      <div class="tagline">Sesión bloqueada</div>
    </div>
    <div class="auth-card">
      <div id="lock-msg"></div>
      <button class="btn" id="faceid-btn">Entrar con Face ID</button>
      <p class="auth-foot">
        ¿No te reconoce?
        <button type="button" class="link-btn" id="use-pass">Usar contraseña</button>
      </p>
    </div>
  `;

  const msg = el.querySelector('#lock-msg');
  const btn = el.querySelector('#faceid-btn');

  async function tryUnlock() {
    msg.innerHTML = '';
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    try {
      const ok = await verify();
      if (ok) {
        onUnlock();
        return;
      }
      throw new Error('no-verificado');
    } catch {
      msg.innerHTML =
        '<div class="msg error">No se reconoció tu Face ID. Intenta de nuevo o usa tu contraseña.</div>';
      btn.disabled = false;
      btn.textContent = 'Entrar con Face ID';
    }
  }

  btn.addEventListener('click', tryUnlock);
  el.querySelector('#use-pass').addEventListener('click', () => onPassword());

  return el;
}
