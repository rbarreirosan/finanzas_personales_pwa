import './style.css';
import { supabaseConfigOk, configError } from './lib/supabase.js';
import { escapeHtml } from './lib/dom.js';
import { getSession, onAuthChange, signOut } from './lib/auth.js';
import { startIdle, stopIdle, idleExpired } from './lib/idle.js';
import { clearCache } from './lib/store.js';
import { isEnabled as faceEnabled } from './lib/faceid.js';
import { LockView } from './views/lock.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { NuevoMovimientoView } from './views/nuevoMovimiento.js';
import { PresupuestosView } from './views/presupuestos.js';
import { AjustesView } from './views/ajustes.js';
import { CuentasView } from './views/cuentas.js';
import { CategoriasView } from './views/categorias.js';
import { MetaView } from './views/meta.js';
import { PresupuestoFormView } from './views/presupuestoForm.js';
import { MovimientosView } from './views/movimientos.js';

const app = document.getElementById('app');

const ICONS = {
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bars: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>',
  card: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>',
};

const routes = {
  '#/dashboard': { view: DashboardView, tab: true },
  '#/nuevo': { view: NuevoMovimientoView, tab: true },
  '#/presupuestos': { view: PresupuestosView, tab: true },
  '#/cuentas': { view: CuentasView, tab: true },
  '#/ajustes': { view: AjustesView },
  '#/categorias': { view: CategoriasView },
  '#/meta': { view: MetaView },
  '#/presupuesto': { view: PresupuestoFormView },
  '#/movimientos': { view: MovimientosView },
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
let locked = false;

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
      ${tab('#/cuentas', ICONS.card, 'Cuentas')}
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

function renderLock() {
  app.innerHTML = '';
  app.appendChild(
    LockView({
      onUnlock: () => {
        locked = false;
        route();
        manageIdle(currentSession);
      },
      onPassword: async () => {
        // Respaldo: salir para entrar con correo y contraseña.
        try {
          await signOut();
        } catch (err) {
          console.error(err);
        }
      },
    })
  );
}

function route() {
  if (!supabaseConfigOk) return renderConfigError();
  if (currentSession) {
    if (locked) renderLock();
    else renderApp();
  } else renderLogin();
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

  // Si hay sesión y Face ID está activo, arranca bloqueada (pide Face ID).
  locked = Boolean(currentSession) && faceEnabled();

  // Sin Face ID: si se reabre la app tras superar el tiempo de inactividad,
  // cierra la sesión (el respaldo de "cerrar por inactividad" al reabrir).
  if (currentSession && !faceEnabled() && idleExpired()) {
    try {
      sessionStorage.setItem('fp_idle_logout', '1');
    } catch {
      /* ignora */
    }
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
    currentSession = null;
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
    // Al cerrar sesión, borra los datos cacheados (privacidad en el dispositivo).
    if (!session) clearCache();
    // Al iniciar sesión con contraseña, o al cerrar, no se queda bloqueada.
    if (!session || !wasLoggedIn) locked = false;
    manageIdle(session);
    if (Boolean(session) !== wasLoggedIn) {
      if (session && !routes[location.hash]) location.hash = '#/dashboard';
      route();
    }
  });

  window.addEventListener('hashchange', () => {
    if (currentSession && supabaseConfigOk) renderApp();
  });

  manageIdle(currentSession);
  route();
}

// Tras 10 min de inactividad: si Face ID está activo, BLOQUEA (se reabre con
// Face ID); si no, cierra la sesión. No corre mientras ya está bloqueada.
function manageIdle(session) {
  stopIdle();
  if (!session || locked) return;

  if (faceEnabled()) {
    startIdle(() => {
      locked = true;
      stopIdle();
      route();
    });
  } else {
    startIdle(async () => {
      try {
        sessionStorage.setItem('fp_idle_logout', '1');
      } catch {
        /* ignora */
      }
      try {
        await signOut();
      } catch (err) {
        console.error(err);
      }
    });
  }
}

// Aviso flotante "sin conexión": informativo, no bloquea la interacción.
function setupOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.textContent = 'Sin conexión · mostrando los últimos datos';
    document.body.appendChild(banner);
  }
  const update = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
setupOfflineBanner();

bootstrap();

// ---------- Service Worker ----------
// SW real (public/sw.js): cachea la cáscara de la app para que abra sin
// conexión. index.html va "red primero", así que al publicar una versión nueva
// se toma en cuanto haya red; sin red, se usa la última copia guardada.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error(err));
  });
}
