// Cierre de sesión por inactividad.
// Reinicia un temporizador con cualquier actividad; si pasan `timeout` ms sin
// actividad, ejecuta el callback (cerrar sesión). También cubre el caso de
// volver a la app tras dejarla en segundo plano más del tiempo permitido.
const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const KEY = 'fp_last_active';
const EVENTS = ['click', 'keydown', 'pointerdown', 'touchstart', 'mousemove', 'scroll'];

let timer = null;
let cb = null;
let timeout = DEFAULT_TIMEOUT;
let lastReset = 0;
let running = false;

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}
function mark() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
}
function arm() {
  clearTimeout(timer);
  timer = setTimeout(fire, timeout);
}
function reset() {
  lastReset = Date.now();
  mark();
  arm();
}
function fire() {
  if (!running) return;
  const f = cb;
  stopIdle();
  if (f) f();
}
function onActivity() {
  if (!running) return;
  // Throttle: como mucho un reinicio cada 5 s (evita escrituras constantes).
  if (Date.now() - lastReset > 5000) reset();
}
function onVisibility() {
  if (!running) return;
  if (document.visibilityState === 'visible') {
    const s = stored();
    if (s != null && Date.now() - s >= timeout) fire();
    else reset();
  }
}

// ¿La última actividad registrada ya excede el tiempo permitido?
export function idleExpired(ms = DEFAULT_TIMEOUT) {
  const s = stored();
  return s != null && Date.now() - s >= ms;
}

export function startIdle(onTimeout, ms = DEFAULT_TIMEOUT) {
  stopIdle();
  cb = onTimeout;
  timeout = ms;
  running = true;

  // Siempre marca "ahora" y arranca el conteo limpio. NO dispara de inmediato
  // aunque la última actividad fuera vieja: eso causaba re-bloqueo instantáneo
  // al desbloquear con Face ID. El caso "reabrir tras mucho tiempo" se maneja
  // aparte (al iniciar la app) y con el evento de volver a primer plano.
  reset();
  EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onVisibility);
  return stopIdle;
}

export function stopIdle() {
  running = false;
  clearTimeout(timer);
  timer = null;
  EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('focus', onVisibility);
}
