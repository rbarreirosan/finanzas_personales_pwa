# Finanzas Personales — PWA

App de finanzas personales (PWA instalable) conectada a **Supabase**
(tablas, vistas y funciones RPC del `schema_finanzas.sql`).

## Stack

- [Vite](https://vitejs.dev/) + JavaScript (ES modules), sin framework.
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript) para Auth + datos.
- Service worker + `manifest.webmanifest` para instalar en iPhone/Android.

## Configuración

Las credenciales de Supabase **nunca** van hardcodeadas: se leen de variables
de entorno vía `import.meta.env`.

1. Copia la plantilla y rellena tus valores (Supabase → **Settings → API**):

   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-public-key
   ```

   > Usa la clave **anon / public**, nunca la `service_role`. El archivo `.env`
   > está en `.gitignore` y no se sube al repositorio.

2. Instala dependencias y arranca en desarrollo:

   ```bash
   npm install
   npm run dev
   ```

3. Build de producción:

   ```bash
   npm run build   # genera dist/
   npm run preview # sirve dist/ localmente
   ```

## Qué está conectado

- **Auth**: email + password (`supabase.auth`). Solo tú ves tus datos (RLS activo).
- **Dashboard**: `fn_disponible_real` (KPI principal ⭐), `fn_kpis_mes`,
  `fn_patrimonio`, `fn_colchon_meses`.
- **Nuevo movimiento**: inserta en `transacciones` respetando las validaciones
  (monto > 0; transferencia requiere cuenta destino distinta y sin categoría;
  ingreso/gasto requieren categoría). Autosugiere categoría con
  `fn_sugerir_categoria` al escribir comercio/descripción.
- **Presupuestos**: lee la vista `v_presupuestos` (gastado, disponible,
  % consumido y semáforo ya calculados).

## PWA / instalar en iPhone

1. Despliega el build (o `npm run preview`) sobre **HTTPS**.
2. En Safari (iPhone): **Compartir → Agregar a pantalla de inicio**.
3. Se abre a pantalla completa (`display: standalone`), sin barra de Safari,
   con su ícono propio.

## Iconos

Los PNG de `public/icons/` se generan desde `public/icons/icon.svg`:

```bash
npm run gen:icons
```
