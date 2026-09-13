import { supabase } from './supabase.js';

// ============================================================================
// Capa de datos: envuelve las funciones RPC, vistas y tablas reales del
// esquema (schema_finanzas.sql). RLS esta activo, asi que cada consulta solo
// devuelve/afecta los datos del usuario autenticado.
//
// Las funciones RPC del esquema reciben p_user uuid explicito; se pasa el id
// del usuario en sesion. (RLS ademas garantiza que no se pueda leer lo ajeno.)
// ============================================================================

async function requireUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('No hay sesion activa.');
  return user.id;
}

// ---------- KPIs del Dashboard ----------

// ⭐ KPI principal: "Disponible real para gastar" (fn_disponible_real, §2.7)
export async function getDisponibleReal(mes) {
  const p_user = await requireUserId();
  const { data, error } = await supabase.rpc('fn_disponible_real', {
    p_user,
    p_mes: mes,
  });
  if (error) throw error;
  // La funcion devuelve una tabla de una fila.
  return Array.isArray(data) ? data[0] : data;
}

export async function getKpisMes(mes) {
  const p_user = await requireUserId();
  const { data, error } = await supabase.rpc('fn_kpis_mes', {
    p_user,
    p_mes: mes,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function getPatrimonio() {
  const p_user = await requireUserId();
  const { data, error } = await supabase.rpc('fn_patrimonio', { p_user });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function getColchonMeses() {
  const p_user = await requireUserId();
  const { data, error } = await supabase.rpc('fn_colchon_meses', { p_user });
  if (error) throw error;
  return data; // numeric escalar (puede ser null)
}

// ---------- Datos de referencia (para el formulario) ----------

export async function getCuentas() {
  const { data, error } = await supabase
    .from('cuentas')
    .select('id, nombre, tipo, moneda, activa')
    .eq('activa', true)
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function getCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, tipo, grupo, color, icono')
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

// ---------- Sugerencia de categoria (fn_sugerir_categoria, §4.3) ----------
// campo: 'comercio' | 'descripcion' ; tipo: 'ingreso' | 'gasto'
export async function sugerirCategoria(texto, campo, tipo) {
  if (!texto || !texto.trim()) return null;
  const p_user = await requireUserId();
  const { data, error } = await supabase.rpc('fn_sugerir_categoria', {
    p_user,
    p_texto: texto,
    p_campo: campo,
    p_tipo: tipo,
  });
  if (error) throw error;
  return data ?? null; // uuid de categoria o null
}

// ---------- Insertar movimiento (tabla transacciones) ----------
// Respeta las validaciones del esquema:
//  - monto > 0
//  - transferencia: cuenta_destino_id != cuenta_id y categoria_id null
//  - ingreso/gasto: categoria_id requerida y cuenta_destino_id null
export async function crearTransaccion(mov) {
  const user_id = await requireUserId();

  const monto = Number(mov.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto debe ser mayor a 0.');
  }
  if (!mov.cuenta_id) throw new Error('Selecciona una cuenta origen.');

  if (mov.tipo === 'transferencia') {
    if (!mov.cuenta_destino_id) {
      throw new Error('La transferencia requiere una cuenta destino.');
    }
    if (mov.cuenta_destino_id === mov.cuenta_id) {
      throw new Error('La cuenta destino debe ser distinta de la origen.');
    }
  } else {
    if (!mov.categoria_id) {
      throw new Error('Ingreso y gasto requieren una categoria.');
    }
  }

  const payload = {
    user_id,
    fecha: mov.fecha,
    tipo: mov.tipo,
    monto,
    cuenta_id: mov.cuenta_id,
    cuenta_destino_id: mov.tipo === 'transferencia' ? mov.cuenta_destino_id : null,
    categoria_id: mov.tipo === 'transferencia' ? null : mov.categoria_id,
    comercio: mov.comercio?.trim() || null,
    descripcion: mov.descripcion?.trim() || null,
    etiquetas: mov.etiquetas?.trim() || null,
  };

  const { data, error } = await supabase
    .from('transacciones')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Presupuestos (vista v_presupuestos, §2.4) ----------
export async function getPresupuestos(mes) {
  const { data, error } = await supabase
    .from('v_presupuestos')
    .select(
      'id, mes, categoria_nombre, grupo, monto_presupuestado, monto_gastado, disponible, pct_consumido, semaforo'
    )
    .eq('mes', mes)
    .order('grupo')
    .order('categoria_nombre');
  if (error) throw error;
  return data ?? [];
}
