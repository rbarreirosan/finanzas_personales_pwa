-- ============================================================================
-- Metas de compra/ahorro  ·  tablas: metas, meta_items
-- Ejecutar en Supabase → SQL Editor.  NO aplica cambios de datos existentes.
--
-- Convenciones tomadas del esquema actual (schema_finanzas.sql):
--   · id uuid default gen_random_uuid()
--   · user_id uuid not null references auth.users(id) on delete cascade
--   · montos numeric(14,2)
--   · created_at timestamptz not null default now()
--   · RLS activo con 4 políticas por tabla (auth.uid() = user_id)
--
-- "Invertido" y "%" NO se guardan: se calculan en el cliente sumando ítems.
-- ============================================================================

create table if not exists public.metas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  nombre         text not null,
  emoji          text,
  fecha_objetivo date,
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.meta_items (
  id              uuid primary key default gen_random_uuid(),
  meta_id         uuid not null references public.metas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  nombre          text not null,
  precio_estimado numeric(14,2) not null default 0 check (precio_estimado >= 0),
  precio_real     numeric(14,2) check (precio_real >= 0),
  prioridad       text not null default 'media' check (prioridad in ('alta','media','baja')),
  nota            text,
  comprado        boolean not null default false,
  fecha_compra    date,
  -- Si el gasto ligado se borra por otro lado, el vínculo se limpia solo.
  gasto_id        uuid references public.transacciones(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_metas_user       on public.metas(user_id);
create index if not exists idx_meta_items_meta   on public.meta_items(meta_id);
create index if not exists idx_meta_items_user   on public.meta_items(user_id);

-- ---------- RLS: cada usuario solo ve y modifica lo suyo ----------
alter table public.metas      enable row level security;
alter table public.meta_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['metas','meta_items']
  loop
    execute format($f$
      create policy %1$I_select on public.%1$I for select using (auth.uid() = user_id);
      create policy %1$I_insert on public.%1$I for insert with check (auth.uid() = user_id);
      create policy %1$I_update on public.%1$I for update using (auth.uid() = user_id);
      create policy %1$I_delete on public.%1$I for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- ---------- Refuerzo en BD: máximo 3 metas activas por usuario ----------
-- (la app también lo valida antes de crear)
create or replace function public.fn_limite_metas_activas()
returns trigger language plpgsql as $$
begin
  if new.activa and (
      select count(*) from public.metas
      where user_id = new.user_id and activa and id <> new.id
    ) >= 3 then
    raise exception 'Máximo 3 metas activas por usuario';
  end if;
  return new;
end $$;

drop trigger if exists trg_limite_metas_activas on public.metas;
create trigger trg_limite_metas_activas
  before insert or update on public.metas
  for each row execute function public.fn_limite_metas_activas();
