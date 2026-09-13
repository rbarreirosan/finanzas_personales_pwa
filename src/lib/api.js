import { supabase } from './supabase.js';
import { cachedRead } from './store.js';

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
export function getDisponibleReal(mes) {
  return cachedRead(`disp_${mes}`, async () => {
    const p_user = await requireUserId();
    const { data, error } = await supabase.rpc('fn_disponible_real', {
      p_user,
      p_mes: mes,
    });
    if (error) throw error;
    // La funcion devuelve una tabla de una fila.
    return Array.isArray(data) ? data[0] : data;
  });
}

export function getKpisMes(mes) {
  return cachedRead(`kpis_${mes}`, async () => {
    const p_user = await requireUserId();
    const { data, error } = await supabase.rpc('fn_kpis_mes', {
      p_user,
      p_mes: mes,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  });
}

export function getPatrimonio() {
  return cachedRead('patrimonio', async () => {
    const p_user = await requireUserId();
    const { data, error } = await supabase.rpc('fn_patrimonio', { p_user });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  });
}

export function getColchonMeses() {
  return cachedRead('colchon', async () => {
    const p_user = await requireUserId();
    const { data, error } = await supabase.rpc('fn_colchon_meses', { p_user });
    if (error) throw error;
    return data; // numeric escalar (puede ser null)
  });
}

// ---------- Datos de referencia (para el formulario) ----------

export function getCuentas() {
  return cachedRead('cuentas', async () => {
    const { data, error } = await supabase
      .from('cuentas')
      .select('id, nombre, tipo, moneda, activa')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  });
}

export function getCategorias() {
  return cachedRead('categorias', async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre, tipo, grupo, color, icono')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  });
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

// ---------- Movimientos (tabla transacciones): crear, editar, eliminar ----------
// Valida y normaliza según las reglas del esquema:
//  - monto > 0
//  - transferencia: cuenta_destino_id != cuenta_id y categoria_id null
//  - ingreso/gasto: categoria_id requerida y cuenta_destino_id null
function normalizeMov(mov) {
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

  return {
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
}

export async function crearTransaccion(mov) {
  const user_id = await requireUserId();
  const payload = { user_id, ...normalizeMov(mov) };
  const { data, error } = await supabase
    .from('transacciones')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Edita un movimiento existente (RLS garantiza que sea del usuario).
export async function actualizarTransaccion(id, mov) {
  if (!id) throw new Error('Falta el id del movimiento.');
  const payload = normalizeMov(mov);
  const { data, error } = await supabase
    .from('transacciones')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarTransaccion(id) {
  const { error } = await supabase.from('transacciones').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Presupuestos (vista v_presupuestos, §2.4) ----------
export function getPresupuestos(mes) {
  return cachedRead(`presupuestos_${mes}`, async () => {
    const { data, error } = await supabase
      .from('v_presupuestos')
      .select(
        'id, mes, categoria_id, categoria_nombre, grupo, monto_presupuestado, monto_gastado, disponible, pct_consumido, semaforo, rollover'
      )
      .eq('mes', mes)
      .order('grupo')
      .order('categoria_nombre');
    if (error) throw error;
    return data ?? [];
  });
}

// ============================================================================
// Administración (CRUD): cuentas, categorías, presupuestos y configuración.
// Cada insert añade user_id del usuario en sesión (RLS lo exige).
// ============================================================================

// ---------- Cuentas ----------
// Usa la vista v_saldo_cuentas: incluye `saldo_actual` (saldo inicial +/-
// ingresos, gastos y transferencias), no solo el saldo inicial.
export function listCuentas() {
  return cachedRead('listCuentas', async () => {
    const { data, error } = await supabase
      .from('v_saldo_cuentas')
      .select(
        'id, nombre, tipo, moneda, saldo_inicial, saldo_actual, limite_credito, activa'
      )
      .order('activa', { ascending: false })
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  });
}

// ---------- Movimientos (vista v_transacciones) ----------
// Lista de transacciones con nombres de cuenta/categoría ya resueltos,
// ordenadas de la más reciente a la más antigua.
export function getMovimientos(limit = 200) {
  return cachedRead('movimientos', async () => {
    const { data, error } = await supabase
      .from('v_transacciones')
      .select(
        'id, fecha, tipo, monto, comercio, descripcion, etiquetas, cuenta_id, cuenta_destino_id, categoria_id, cuenta_nombre, cuenta_destino_nombre, categoria_nombre, created_at'
      )
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

export async function guardarCuenta(cuenta, id = null) {
  const nombre = (cuenta.nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la cuenta es obligatorio.');
  if (cuenta.tipo === 'credito' && cuenta.limite_credito == null) {
    throw new Error('Una cuenta de crédito requiere límite de crédito.');
  }
  const payload = {
    nombre,
    tipo: cuenta.tipo,
    moneda: cuenta.moneda || 'MXN',
    saldo_inicial: Number(cuenta.saldo_inicial) || 0,
    limite_credito:
      cuenta.tipo === 'credito' && cuenta.limite_credito != null
        ? Number(cuenta.limite_credito)
        : null,
    activa: cuenta.activa !== false,
  };
  if (id) {
    const { data, error } = await supabase
      .from('cuentas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  payload.user_id = await requireUserId();
  const { data, error } = await supabase
    .from('cuentas')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCuenta(id) {
  const { error } = await supabase.from('cuentas').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Categorías ----------
export async function guardarCategoria(cat, id = null) {
  const nombre = (cat.nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la categoría es obligatorio.');
  const tipo = cat.tipo;
  // Regla del esquema: ingreso -> grupo ingreso; gasto -> esencial/discrecional.
  const grupo = tipo === 'ingreso' ? 'ingreso' : cat.grupo || 'discrecional';
  const payload = {
    nombre,
    tipo,
    grupo,
    color: cat.color || '#94A3B8',
    icono: (cat.icono || '').trim() || '💸',
  };
  if (id) {
    const { data, error } = await supabase
      .from('categorias')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  payload.user_id = await requireUserId();
  const { data, error } = await supabase
    .from('categorias')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCategoria(id) {
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Presupuestos ----------
export async function guardarPresupuesto(pres) {
  if (!pres.categoria_id) throw new Error('Selecciona una categoría.');
  const monto = Number(pres.monto_presupuestado);
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error('El monto presupuestado no puede ser negativo.');
  }
  const user_id = await requireUserId();
  const payload = {
    user_id,
    mes: pres.mes,
    categoria_id: pres.categoria_id,
    monto_presupuestado: monto,
    rollover: !!pres.rollover,
  };
  // unique(user_id, mes, categoria_id): upsert para crear o actualizar.
  const { data, error } = await supabase
    .from('presupuestos')
    .upsert(payload, { onConflict: 'user_id,mes,categoria_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarPresupuesto(id) {
  const { error } = await supabase.from('presupuestos').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Configuración (meta de ahorro) ----------
export function getConfiguracion() {
  return cachedRead('configuracion', async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('user_id, mes_analizado, meta_ahorro_mensual')
      .maybeSingle();
    if (error) throw error;
    return data;
  });
}

export async function guardarConfiguracion(cfg) {
  const user_id = await requireUserId();
  const payload = {
    user_id,
    meta_ahorro_mensual: Number(cfg.meta_ahorro_mensual) || 0,
  };
  if (cfg.mes_analizado) payload.mes_analizado = cfg.mes_analizado;
  const { data, error } = await supabase
    .from('configuracion')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
