// Bloqueo biométrico local con Face ID / Touch ID (WebAuthn).
// Es un "candado" en el dispositivo: al activarlo se registra una credencial de
// plataforma y, para entrar, se pide verificación biométrica. No reemplaza la
// contraseña (que sigue disponible como respaldo), solo evita re-teclearla.
const KEY = 'fp_faceid_id';

function b64urlFromBuf(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bufFromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s + pad);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function rand(n) {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u.buffer;
}

export function isSupported() {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!(navigator.credentials && navigator.credentials.create)
  );
}

export function isEnabled() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

// Registra la credencial de plataforma (dispara Face ID una vez).
export async function enable(name = 'Finanzas') {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'Finanzas Personales', id: location.hostname },
      user: { id: rand(16), name, displayName: name },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  if (!cred) throw new Error('No se pudo activar Face ID.');
  try {
    localStorage.setItem(KEY, b64urlFromBuf(cred.rawId));
  } catch {
    throw new Error('No se pudo guardar la preferencia en este dispositivo.');
  }
  return true;
}

export function disable() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

// Pide Face ID para desbloquear. Devuelve true si se verificó.
export async function verify() {
  let id;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    id = null;
  }
  if (!id) return false;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [
        { id: bufFromB64url(id), type: 'public-key', transports: ['internal'] },
      ],
      userVerification: 'required',
      timeout: 60000,
      rpId: location.hostname,
    },
  });
  return !!assertion;
}
