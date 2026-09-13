// Caché local de datos para modo sin conexión (solo lectura).
//
// Cada lectura de la nube se envuelve con `cachedRead`: si hay red, trae los
// datos frescos y los guarda; si la red falla (sin conexión), devuelve lo
// último guardado en el dispositivo. Así la app abre y muestra los últimos
// datos aunque no haya señal. Las escrituras NO se cachean: sin conexión no se
// puede guardar en la nube y el formulario avisa del error.
const PREFIX = 'fp_data_';

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: no cachea, no pasa nada */
  }
}

// Borra todos los datos cacheados (al cerrar sesión, por privacidad).
export function clearCache() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignora */
  }
}

// Red primero; si falla, último valor guardado. Marca `staleServed` cuando lo
// que se devolvió vino del caché (para poder avisar "sin conexión").
export let staleServed = false;

export async function cachedRead(key, fn) {
  try {
    const data = await fn();
    writeCache(key, data);
    staleServed = false;
    return data;
  } catch (err) {
    const cached = readCache(key);
    if (cached !== undefined) {
      staleServed = true;
      return cached;
    }
    throw err;
  }
}
