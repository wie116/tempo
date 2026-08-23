-- Tempo · esquema completo
-- Pegá TODO esto en el SQL Editor de tu proyecto Supabase y ejecutalo.
-- Es idempotente: podés correrlo de nuevo sin romper nada.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Datos mínimos de cuenta para estadísticas. No se expone al cliente y evita
-- mezclar permisos administrativos con el perfil que sincroniza settings.
create table if not exists app_user_metrics (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null
);

-- Una fila por usuario y día alcanza para medir actividad sin guardar cada
-- clic ni reconstruir agendas individuales desde el panel administrativo.
create table if not exists app_daily_activity (
  user_id uuid not null references auth.users on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists lists (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#2F6F5E',
  sort_order int not null default 0,
  collapsed boolean not null default false,
  scope text not null default 'todo' check (scope in ('todo','routine')),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  list_id uuid references lists on delete cascade,
  title text not null,
  -- null = sin duración fija
  estimated_min int,
  -- null = hereda el color del grupo
  color text,
  is_recurring boolean not null default false,
  repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly','yearly')),
  repeat_until date,
  repeat_weekdays int[],
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  planned_date date,
  due_date date,
  is_inbox boolean not null default false,
  is_archived boolean not null default false,
  notes text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists blocks (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid references tasks on delete set null,
  title text not null,
  color text not null default '#2F6F5E',
  -- Texto a propósito, no timestamptz: un bloque de las 09:30 tiene que seguir
  -- siendo de las 09:30 aunque cambies de zona horaria. Es hora de pared.
  starts_at text not null,
  duration_min int not null check (duration_min >= 10),
  kind text not null default 'task' check (kind in ('task','break','adhoc')),
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  closed_at bigint,
  pinned boolean not null default false,
  series_id uuid,
  notes text not null default '',
  icon text,
  repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly','yearly')),
  repeat_until date,
  repeat_weekdays int[],
  -- La referencia externa nunca contiene tokens ni secretos OAuth.
  source text not null default 'tempo' check (source in ('tempo','google-calendar')),
  external_ref jsonb,
  sync_status text not null default 'local'
    check (sync_status in ('local','synced','pending','conflict','error')),
  updated_at timestamptz not null default now()
);

-- Conexiones externas. No tienen políticas para el cliente: solamente las
-- Edge Functions con service_role pueden leer estos tokens cifrados.
create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null default 'google-calendar' check (provider in ('google-calendar')),
  email text not null default '',
  encrypted_refresh_token text not null,
  token_iv text not null,
  selected_calendar_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Estado temporal y de un solo uso para state + PKCE.
create table if not exists calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  code_verifier text not null,
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists calendar_sync_state (
  connection_id uuid not null references calendar_connections on delete cascade,
  calendar_id text not null,
  sync_token text,
  last_synced_at timestamptz,
  primary key (connection_id, calendar_id)
);

-- Para bases creadas antes de que existiera el candadito de bloque:
alter table blocks add column if not exists pinned boolean not null default false;
alter table blocks add column if not exists series_id uuid;
alter table blocks add column if not exists source text not null default 'tempo';
alter table blocks add column if not exists external_ref jsonb;
alter table blocks add column if not exists sync_status text not null default 'local';
alter table blocks add column if not exists icon text;
alter table blocks add column if not exists repeat text not null default 'none';
alter table blocks add column if not exists repeat_until date;
alter table blocks add column if not exists repeat_weekdays int[];
alter table lists add column if not exists scope text not null default 'todo';
alter table tasks add column if not exists priority text not null default 'normal';
alter table tasks add column if not exists planned_date date;
alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists is_inbox boolean not null default false;
alter table blocks drop constraint if exists blocks_status_check;
alter table blocks add constraint blocks_status_check check (status in ('planned','done','skipped'));
alter table blocks drop constraint if exists blocks_source_check;
alter table blocks add constraint blocks_source_check check (source in ('tempo','google-calendar'));
alter table blocks drop constraint if exists blocks_sync_status_check;
alter table blocks add constraint blocks_sync_status_check
  check (sync_status in ('local','synced','pending','conflict','error'));
alter table tasks  add column if not exists repeat text not null default 'none';
alter table tasks  add column if not exists repeat_until date;
alter table tasks  add column if not exists repeat_weekdays int[];
alter table tasks  drop constraint if exists tasks_repeat_check;
alter table tasks  add constraint tasks_repeat_check check (repeat in ('none','daily','weekly','monthly','yearly'));
alter table lists drop constraint if exists lists_scope_check;
alter table lists add constraint lists_scope_check check (scope in ('todo','routine'));
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check check (priority in ('low','normal','high','urgent'));
alter table blocks drop constraint if exists blocks_repeat_check;
alter table blocks add constraint blocks_repeat_check check (repeat in ('none','daily','weekly','monthly','yearly'));

-- Recupera la fecha real de registro para cuentas existentes. Como aproximación
-- inicial de actividad histórica usamos el último inicio de sesión de Auth;
-- desde esta migración en adelante el latido de la app será la fuente exacta.
insert into public.profiles (id)
select
  u.id
from auth.users u
on conflict (id) do nothing;

insert into public.app_user_metrics (user_id, created_at)
select u.id, u.created_at
from auth.users u
on conflict (user_id) do update set created_at = excluded.created_at;

insert into public.app_daily_activity (user_id, activity_date, first_seen_at, last_seen_at)
select
  u.id,
  (coalesce(u.last_sign_in_at, u.created_at) at time zone 'America/Argentina/Buenos_Aires')::date,
  coalesce(u.last_sign_in_at, u.created_at),
  coalesce(u.last_sign_in_at, u.created_at)
from auth.users u
on conflict (user_id, activity_date) do nothing;

-- Migración de datos previa al nuevo modelo. Las clasificaciones de To-Do y
-- Rutinas son independientes: por cada lista antigua que contiene rutinas,
-- creamos una clasificación paralela y movemos sólo esas tareas. Es segura al
-- reejecutar porque después del primer pase ya no quedan rutinas en la lista
-- de scope `todo` que les dio origen.
do $$
declare
  source_list record;
  routine_list_id uuid;
begin
  for source_list in
    select distinct l.id, l.user_id, l.name, l.color, l.sort_order, l.collapsed
    from public.lists l
    join public.tasks t on t.list_id = l.id
    where l.scope = 'todo'
      and (t.is_recurring or t.repeat <> 'none')
  loop
    routine_list_id := gen_random_uuid();
    insert into public.lists (
      id, user_id, name, color, sort_order, collapsed, scope
    ) values (
      routine_list_id, source_list.user_id, source_list.name,
      source_list.color, source_list.sort_order, source_list.collapsed, 'routine'
    );

    update public.tasks
    set list_id = routine_list_id, updated_at = now()
    where list_id = source_list.id
      and (is_recurring or repeat <> 'none');
  end loop;
end
$$;

-- Las reglas antiguas estaban guardadas en la tarea. Las copiamos a los
-- bloques que ya formaban una serie y luego dejamos la tarea como plantilla
-- reutilizable, sin alterar las ocurrencias existentes.
update public.blocks b
set
  repeat = t.repeat,
  repeat_until = t.repeat_until,
  repeat_weekdays = t.repeat_weekdays,
  updated_at = now()
from public.tasks t
where b.task_id = t.id
  and b.series_id is not null
  and b.repeat = 'none'
  and t.repeat <> 'none';

update public.tasks
set repeat = 'none', repeat_until = null, repeat_weekdays = null, updated_at = now()
where repeat <> 'none' or repeat_until is not null or repeat_weekdays is not null;

notify pgrst, 'reload schema';

create index if not exists blocks_user_start_idx on blocks (user_id, starts_at);
create unique index if not exists blocks_external_event_idx on blocks (
  user_id,
  (external_ref->>'provider'),
  (external_ref->>'accountId'),
  (external_ref->>'calendarId'),
  (external_ref->>'eventId')
) where external_ref is not null;
create index if not exists tasks_user_list_idx on tasks (user_id, list_id);
create index if not exists lists_user_idx on lists (user_id);
create index if not exists app_user_metrics_created_at_idx on app_user_metrics (created_at);
create index if not exists app_daily_activity_date_user_idx on app_daily_activity (activity_date, user_id);

-- Aislamiento por usuario: nadie ve datos de nadie.
alter table profiles enable row level security;
alter table app_user_metrics enable row level security;
alter table app_daily_activity enable row level security;
alter table lists    enable row level security;
alter table tasks    enable row level security;
alter table blocks   enable row level security;
alter table calendar_connections enable row level security;
alter table calendar_oauth_states enable row level security;
alter table calendar_sync_state enable row level security;

drop policy if exists "profiles propios" on profiles;
create policy "profiles propios" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

revoke all on table public.app_user_metrics from anon, authenticated;

drop policy if exists "actividad propia" on app_daily_activity;
drop policy if exists "leer actividad propia" on app_daily_activity;
create policy "leer actividad propia" on app_daily_activity
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "registrar actividad propia" on app_daily_activity;
create policy "registrar actividad propia" on app_daily_activity
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and activity_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

drop policy if exists "actualizar actividad propia" on app_daily_activity;
create policy "actualizar actividad propia" on app_daily_activity
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and activity_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  )
  with check (
    (select auth.uid()) = user_id
    and activity_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

revoke all on table public.app_daily_activity from anon, authenticated;
grant select, insert, update on table public.app_daily_activity to authenticated;

drop policy if exists "lists propias" on lists;
create policy "lists propias" on lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks propias" on tasks;
create policy "tasks propias" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "blocks propios" on blocks;
create policy "blocks propios" on blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  insert into public.app_user_metrics (user_id, created_at)
  values (new.id, new.created_at)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Marca uso real de la aplicación. No acepta ids ni fechas del cliente: ambos
-- se obtienen de la sesión y del reloj del servidor.
create or replace function public.touch_app_activity()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_activity_date date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if current_user_id is null then
    raise exception 'Sesión requerida';
  end if;

  insert into public.app_daily_activity (user_id, activity_date, first_seen_at, last_seen_at)
  values (current_user_id, current_activity_date, now(), now())
  on conflict (user_id, activity_date) do update
  set last_seen_at = excluded.last_seen_at;
end;
$$;

revoke execute on function public.touch_app_activity() from public, anon;
grant execute on function public.touch_app_activity() to authenticated;

-- Agrega estadísticas sin devolver filas individuales. Solo la service_role
-- puede ejecutarla y esa clave vive exclusivamente dentro de la Edge Function.
create or replace function public.admin_dashboard_metrics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      (now() at time zone 'America/Argentina/Buenos_Aires')::date as today,
      date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date as month_start,
      date_trunc('year', now() at time zone 'America/Argentina/Buenos_Aires')::date as year_start
  ), dates as (
    select
      today,
      (today - (extract(isodow from today)::int - 1))::date as week_start,
      month_start,
      year_start
    from bounds
  ), profile_stats as (
    select
      count(*)::int as total,
      count(*) filter (where (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= d.today)::int as new_today,
      count(*) filter (where (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= d.week_start)::int as new_week,
      count(*) filter (where (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= d.month_start)::int as new_month,
      count(*) filter (where (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= d.year_start)::int as new_year
    from public.app_user_metrics p cross join dates d
  ), activity_stats as (
    select
      count(distinct a.user_id) filter (where a.activity_date >= d.today)::int as active_today,
      count(distinct a.user_id) filter (where a.activity_date >= d.week_start)::int as active_week,
      count(distinct a.user_id) filter (where a.activity_date >= d.month_start)::int as active_month,
      count(distinct a.user_id) filter (where a.activity_date >= d.year_start)::int as active_year
    from public.app_daily_activity a cross join dates d
  ), task_stats as (
    select
      count(*)::int as total,
      count(*) filter (where not t.is_recurring)::int as todos,
      count(*) filter (where t.is_recurring)::int as routines,
      count(*) filter (where t.is_archived)::int as archived,
      count(distinct t.user_id)::int as users_with_tasks
    from public.tasks t
  ), block_stats as (
    select
      count(*)::int as total,
      count(*) filter (where b.kind <> 'break')::int as task_blocks,
      count(*) filter (where b.kind <> 'break' and b.status = 'done')::int as done,
      count(*) filter (where b.kind <> 'break' and b.status = 'skipped')::int as skipped,
      count(*) filter (where b.kind = 'break')::int as breaks,
      count(*) filter (where b.source = 'google-calendar')::int as imported,
      count(distinct b.user_id)::int as users_with_blocks,
      coalesce(sum(b.duration_min), 0)::bigint as scheduled_minutes,
      coalesce(sum(b.duration_min) filter (where b.kind <> 'break' and b.status = 'done'), 0)::bigint as completed_minutes
    from public.blocks b
  ), connection_stats as (
    select count(distinct c.user_id)::int as users from public.calendar_connections c
  ), daily as (
    select day::date as activity_date, count(a.user_id)::int as users
    from dates d
    cross join lateral generate_series(d.today - 29, d.today, interval '1 day') day
    left join public.app_daily_activity a on a.activity_date = day::date
    group by day::date
    order by day::date
  ), daily_json as (
    select coalesce(
      jsonb_agg(jsonb_build_object('date', activity_date, 'users', users) order by activity_date),
      '[]'::jsonb
    ) as points
    from daily
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'users', jsonb_build_object(
      'total', p.total,
      'activeToday', a.active_today,
      'activeWeek', a.active_week,
      'activeMonth', a.active_month,
      'activeYear', a.active_year,
      'newToday', p.new_today,
      'newWeek', p.new_week,
      'newMonth', p.new_month,
      'newYear', p.new_year,
      'withTasks', t.users_with_tasks,
      'withBlocks', b.users_with_blocks,
      'withCalendar', c.users
    ),
    'product', jsonb_build_object(
      'tasks', t.total,
      'todos', t.todos,
      'routines', t.routines,
      'archivedTasks', t.archived,
      'blocks', b.total,
      'taskBlocks', b.task_blocks,
      'completedBlocks', b.done,
      'skippedBlocks', b.skipped,
      'breaks', b.breaks,
      'calendarBlocks', b.imported,
      'scheduledMinutes', b.scheduled_minutes,
      'completedMinutes', b.completed_minutes,
      'completionRate', case when b.done + b.skipped = 0 then 0 else round((b.done::numeric * 100) / (b.done + b.skipped), 1) end,
      'tasksPerUser', case when p.total = 0 then 0 else round(t.total::numeric / p.total, 1) end,
      'blocksPerUser', case when p.total = 0 then 0 else round(b.total::numeric / p.total, 1) end
    ),
    'dailyActivity', j.points
  )
  from profile_stats p
  cross join activity_stats a
  cross join task_stats t
  cross join block_stats b
  cross join connection_stats c
  cross join daily_json j;
$$;

revoke execute on function public.admin_dashboard_metrics() from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics() to service_role;

-- Sincronización en vivo entre dispositivos
-- PostgreSQL no admite `ADD TABLE IF NOT EXISTS` para publications. Además,
-- `pg_publication_tables` puede no reflejar de forma fiable la membresía dentro
-- del mismo lote transaccional del SQL Editor. Intentamos cada alta y absorbemos
-- únicamente `duplicate_object` (SQLSTATE 42710); cualquier otro error sí sale.
do $$
begin
  begin
    alter publication supabase_realtime add table public.lists;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.blocks;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then
    null;
  end;
end
$$;
