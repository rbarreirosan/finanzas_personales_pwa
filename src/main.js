import './style.css';
import { supabaseConfigOk } from './lib/supabase.js';
import { getSession, onAuthChange, signOut } from './lib/auth.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { NuevoMovimientoView } from './views/nuevoMovimiento.js';
import { PresupuestosView } from './views/presupuestos.js';

const app = document.getElementById('app');

const ICONS = {
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bars: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>',
};

const routes = {
  '#/dashboard': { view: DashboardView },
  '#/nuevo': { view: NuevoMovimientoView },
  '#/presupuestos': { view: PresupuestosView },
};

let currentSession = null;

function renderConfigError() {
  app.innerHTML = `
    <div class="auth">
      <div class="brand"><div class="logo">⚙️</div><h1>Configuración pendiente</h1></div>
      <div class="auth-card">
        <p style="margin:0">Faltan las credenciales de Supabase.</p>
        <p class="gr-sub" style="margin:0">
          Copia <code>.env.example</code> a <code>.env</code> y rellena
          <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>
          (Settings → API en tu proyecto), luego reinicia el servidor.
        </p>
      </div>
    </div>
  `;
}

function tabbar(hash) {
  const tab = (h, icon, label) =>
    `<a href="${h}" data-h="${h}" class="${h === hash ? 'active' : ''}">
       <span class="ic">${icon}</span>${label}
     </a>`;
  return `
    <nav class="tabbar">
      ${tab('#/dashboard', ICONS.home, 'Inicio')}
      ${tab('#/nuevo', ICONS.plus, 'Nuevo')}
      ${tab('#/presupuestos', ICONS.bars, 'Presup.')}
    </nav>
  `;
}

function renderApp() {
  const hash = routes[location.hash] ? location.hash : '#/dashboard';
  app.innerHTML = `<div id="view-root"></div>${tabbar(hash)}`;
  app.querySelector('#view-root').appendChild(routes[hash].view());
}

function renderLogin() {
  app.innerHTML = '';
  app.appendChild(LoginView());
}

function route() {
  if (!supabaseConfigOk) return renderConfigError();
  if (currentSession) renderApp();
  else renderLogin();
}

async function bootstrap() {
  if (!supabaseConfigOk) {
    renderConfigError();
    return;
  }

  try {
    currentSession = await getSession();
  } catch (e) {
    console.error(e);
  }

  // Logout por delegación (el botón vive dentro del Dashboard).
  app.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="logout"]');
    if (!btn) return;
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
  });

  onAuthChange((session) => {
    const wasLoggedIn = Boolean(currentSession);
    currentSession = session;
    if (Boolean(session) !== wasLoggedIn) {
      if (session && !routes[location.hash]) location.hash = '#/dashboard';
      route();
    }
  });

  window.addEventListener('hashchange', () => {
    if (currentSession && supabaseConfigOk) renderApp();
  });

  route();
}

bootstrap();

// ---------- Registro del Service Worker (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('SW registro falló:', err));
  });
}
