import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Cliente Supabase. Las credenciales SIEMPRE vienen de variables de entorno
// (archivo .env, gitignored), nunca hardcodeadas en el codigo fuente.
// ----------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigOk = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigOk) {
  console.error(
    '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y rellena tus credenciales.'
  );
}

// Se crea aunque falten credenciales para no romper los imports; la UI muestra
// un aviso claro si supabaseConfigOk === false.
export const supabase = createClient(
  supabaseUrl || 'https://missing.supabase.co',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
