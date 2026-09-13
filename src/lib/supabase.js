import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Cliente Supabase. Las credenciales SIEMPRE vienen de variables de entorno
// (archivo .env en local, o variables del hosting en producción), nunca
// hardcodeadas en el código fuente.
//
// Se valida el formato para que un valor mal pegado (con espacios, sin https://
// o con las dos variables intercambiadas) muestre un aviso claro en pantalla
// en lugar de dejar la página en blanco.
// ----------------------------------------------------------------------------
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export let configError = null; // mensaje legible si algo está mal

function validate(url, key) {
  if (!url || !key) {
    return 'Faltan las credenciales de Supabase.';
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `VITE_SUPABASE_URL no es una URL válida ("${url.slice(0, 40)}"). ` +
      'Debe verse como https://tuproyecto.supabase.co';
  }
  if (parsed.protocol !== 'https:') {
    return 'VITE_SUPABASE_URL debe empezar con https://';
  }
  // La anon key es un JWT largo (empieza con "eyJ"). Si la URL trae "eyJ" o la
  // key parece una URL, probablemente están intercambiadas.
  if (url.includes('eyJ') || key.startsWith('http')) {
    return 'Parece que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están intercambiadas.';
  }
  return null;
}

configError = validate(supabaseUrl, supabaseAnonKey);

let client = null;
if (!configError) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    configError = `No se pudo inicializar Supabase: ${e.message}`;
  }
}

if (configError) {
  console.error('[Supabase]', configError);
}

export const supabaseConfigOk = !configError && !!client;
export const supabase = client;
