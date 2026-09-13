import './style.css';
import { supabaseConfigOk } from './lib/supabase.js';
import { getSession, onAuthChange, signOut } from './lib/auth.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { NuevoMovimientoView } from './views/nuevoMovimiento.js';
import { PresupuestosView } from './views/presupuestos.js';
import { escapeHtml } from './lib/dom.js';

const app = document.getElementById('app');

const routes = {
  '#/dashboard': { title: 'Dashboard', view: DashboardView },
  '#/nuevo': { title: 'Nuevo', view: NuevoMovimientoView },
  '#/presupuestos': { title: 'Presupuestos', view: PresupuestosView },
};

let currentSession = null;

function renderConfigError() {
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="brand"><div class="logo">⚙️</div><h1>Configuración pendiente</h1></div>
      <div class="card">
        <p>Faltan las credenciales de Supabase.</p>
        <p class="hint">
          Copia <code>.env.example</code> a <code>.env</code> y rellena
          <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>
          (Settings → API en tu proyecto), luego reinicia el servidor.
        </p>
      </div>
    </div>
  `;
}

function renderApp() {
  const hash = routes[location.hash] ? location.hash : '#/dashboard';
  const route = routes[hash];

  app.innerHTML = `
    <header class="app-header">
      <h1>${escapeHtml(route.title)}</h1>
      <button class="btn-ghost" id="logout-btn">Salir</button>
    </header>
    <main class="app-main" id="view-root"></main>
    <nav class="tabbar">
      <a href="#/dashboard" data-h="#/dashboard"><span class="icon">📊</span>Inicio</a>
      <a href="#/nuevo" data-h="#/nuevo"><span class="icon">➕</span>Nuevo</a>
      <a href="#/presupuestos" data-h="#/presupuestos"><span class="icon">🎯</span>Presupuestos</a>
    </nav>
  `;

  app.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.h === hash);
  });

  app.querySelector('#logout-btn').addEventListener('click', async () => {
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
  });

  const viewRoot = app.querySelector('#view-root');
  viewRoot.appendChild(route.view());
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

  onAuthChange((session) => {
    const wasLoggedIn = Boolean(currentSession);
    currentSession = session;
    // Re-render completo al cambiar el estado de sesion.
    if (Boolean(session) !== wasLoggedIn) {
      if (session && !location.hash) location.hash = '#/dashboard';
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
