-- Tempo · migración aislada del panel Admin
-- Ejecutar completa en Supabase SQL Editor. No modifica tareas ni bloques.

begin;

create table if not exists public.app_user_metrics (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null
);

create table if not exists public.app_daily_activity (
  user_id uuid not null references auth.users on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

-- Recupera las fechas reales de registro y un punto histórico inicial a partir
-- del último inicio de sesión disponible en Supabase Auth.
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

create index if not exists app_user_metrics_created_at_idx
  on public.app_user_metrics (created_at);
create index if not exists app_daily_activity_date_user_idx
  on public.app_daily_activity (activity_date, user_id);

alter table public.app_user_metrics enable row level security;
alter table public.app_daily_activity enable row level security;

-- Las fechas de registro no son accesibles desde el navegador.
revoke all on table public.app_user_metrics from anon, authenticated;

drop policy if exists "actividad propia" on public.app_daily_activity;
drop policy if exists "leer actividad propia" on public.app_daily_activity;
create policy "leer actividad propia" on public.app_daily_activity
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "registrar actividad propia" on public.app_daily_activity;
create policy "registrar actividad propia" on public.app_daily_activity
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and activity_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

drop policy if exists "actualizar actividad propia" on public.app_daily_activity;
create policy "actualizar actividad propia" on public.app_daily_activity
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

-- Conserva el perfil existente y registra automáticamente futuras cuentas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

-- No recibe ids ni fechas: usa exclusivamente la sesión y el reloj del servidor.
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

-- Devuelve únicamente agregados. La Edge Function es la única que puede
-- ejecutarla porque trabaja con service_role después de validar al admin.
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
    select count(distinct c.user_id)::int as users
    from public.calendar_connections c
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

notify pgrst, 'reload schema';

commit;
