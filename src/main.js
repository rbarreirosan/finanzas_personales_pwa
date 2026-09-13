import './style.css';
import { supabaseConfigOk, configError } from './lib/supabase.js';
import { escapeHtml } from './lib/dom.js';
import { getSession, onAuthChange, signOut } from './lib/auth.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { NuevoMovimientoView } from './views/nuevoMovimiento.js';
import { PresupuestosView } from './views/presupuestos.js';
import { AjustesView } from './views/ajustes.js';
import { CuentasView } from './views/cuentas.js';
import { CategoriasView } from './views/categorias.js';
import { MetaView } from './views/meta.js';
import { PresupuestoFormView } from './views/presupuestoForm.js';

const app = document.getElementById('app');

const ICONS = {
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bars: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>',
};

const routes = {
  '#/dashboard': { view: DashboardView, tab: true },
  '#/nuevo': { view: NuevoMovimientoView, tab: true },
  '#/presupuestos': { view: PresupuestosView, tab: true },
  '#/ajustes': { view: AjustesView },
  '#/cuentas': { view: CuentasView },
  '#/categorias': { view: CategoriasView },
  '#/meta': { view: MetaView },
  '#/presupuesto': { view: PresupuestoFormView },
};

// Separa la ruta ("#/x") de sus parámetros ("?a=b") en el hash.
function parseHash() {
  const raw = location.hash || '#/dashboard';
  const qi = raw.indexOf('?');
  const path = qi === -1 ? raw : raw.slice(0, qi);
  const params = new URLSearchParams(qi === -1 ? '' : raw.slice(qi + 1));
  return { path: routes[path] ? path : '#/dashboard', params };
}

let currentSession = null;

function renderConfigError() {
  app.innerHTML = `
    <div class="auth">
      <div class="brand"><div class="logo">⚙️</div><h1>Configuración pendiente</h1></div>
      <div class="auth-card">
        <p style="margin:0">${escapeHtml(configError || 'Faltan las credenciales de Supabase.')}</p>
        <p class="gr-sub" style="margin:0">
          Revisa <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>
          (en Supabase: Settings → API). En Cloudflare van en Settings →
          Variables and Secrets, y hay que volver a publicar (Retry deployment).
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
  const { path, params } = parseHash();
  const route = routes[path];
  app.innerHTML = `<div id="view-root"></div>${route.tab ? tabbar(path) : ''}`;
  app.querySelector('#view-root').appendChild(route.view(params));
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

// ---------- Service Worker ----------
// Ya NO se registra un SW: durante el desarrollo el caché offline provocaba
// versiones viejas pegadas. Si quedó uno registrado de antes, public/sw.js es
// ahora un "kill-switch" que se da de baja solo y limpia las cachés.
// (El navegador vuelve a pedir /sw.js cuando aún hay un registro previo.)
