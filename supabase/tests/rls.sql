begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(23);

create or replace function pg_temp.exec_count(statement text)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
exception when others then
  return -1;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'rls-a@tempo.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'rls-b@tempo.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into public.lists (id, user_id, name, color, sort_order, collapsed, scope) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lista A', '#2F6F5E', 0, false, 'todo'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Lista B', '#3A4A8C', 0, false, 'todo');

insert into public.tasks (id, user_id, list_id, title) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001', 'Tarea A'),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1000000-0000-4000-8000-000000000001', 'Tarea B');

insert into public.blocks (id, user_id, task_id, title, starts_at, duration_min) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000001', 'Bloque A', '2026-10-20T09:00', 30),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b2000000-0000-4000-8000-000000000001', 'Bloque B', '2026-10-20T10:00', 30);

insert into public.calendar_connections (
  id, user_id, provider, email, encrypted_refresh_token, token_iv
) values (
  'a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'google-calendar', 'rls-a@tempo.invalid', 'test-only', 'test-only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.lists), 1, 'owner sees only their list');
select is((select count(*)::integer from public.lists where id = 'b1000000-0000-4000-8000-000000000001'), 0, 'other user list is hidden');
select is((select count(*)::integer from public.profiles), 1, 'owner sees only their profile');
select is((select count(*)::integer from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'other profile is hidden');
select is((select count(*)::integer from public.tasks), 1, 'owner sees only their task');
select is((select count(*)::integer from public.tasks where id = 'b2000000-0000-4000-8000-000000000001'), 0, 'other task is hidden');
select is((select count(*)::integer from public.blocks), 1, 'owner sees only their block');
select is((select count(*)::integer from public.blocks where id = 'b3000000-0000-4000-8000-000000000001'), 0, 'other block is hidden');

select is(pg_temp.exec_count($sql$insert into public.lists (id, user_id, name) values ('b1000000-0000-4000-8000-000000000099', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bloqueada')$sql$), -1, 'cross-user insert is rejected');
select is(pg_temp.exec_count($sql$insert into public.lists (id, user_id, name) values ('a1000000-0000-4000-8000-000000000099', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Temporal')$sql$), 1, 'owner insert succeeds');
select is(pg_temp.exec_count($sql$update public.lists set name = 'No permitido' where id = 'b1000000-0000-4000-8000-000000000001'$sql$), 0, 'cross-user update affects no rows');
select is(pg_temp.exec_count($sql$update public.lists set name = 'Actualizada' where id = 'a1000000-0000-4000-8000-000000000001'$sql$), 1, 'owner update succeeds');
select is(pg_temp.exec_count($sql$delete from public.lists where id = 'b1000000-0000-4000-8000-000000000001'$sql$), 0, 'cross-user delete affects no rows');
select is(pg_temp.exec_count($sql$delete from public.lists where id = 'a1000000-0000-4000-8000-000000000099'$sql$), 1, 'owner delete succeeds');

select is((select count(*)::integer from public.calendar_connections), 0, 'calendar credentials are hidden from clients');
select is(pg_temp.exec_count($sql$insert into public.calendar_connections (user_id, email, encrypted_refresh_token, token_iv) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'blocked@tempo.invalid', 'x', 'y')$sql$), -1, 'calendar credential writes are rejected');
select is(pg_temp.exec_count('select * from public.app_user_metrics'), -1, 'account metrics are unavailable to clients');
select ok(not has_function_privilege('authenticated', 'public.admin_dashboard_metrics()', 'execute'), 'admin metrics function is service-only');
select ok(has_function_privilege('authenticated', 'public.touch_app_activity()', 'execute'), 'activity heartbeat is available to authenticated users');
select is(pg_temp.exec_count($sql$insert into public.app_daily_activity (user_id, activity_date) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (now() at time zone 'America/Argentina/Buenos_Aires')::date)$sql$), -1, 'activity cannot be recorded for another user');
select is(pg_temp.exec_count($sql$insert into public.app_daily_activity (user_id, activity_date) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (now() at time zone 'America/Argentina/Buenos_Aires')::date)$sql$), 1, 'activity can be recorded for the current user');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select ok(pg_temp.exec_count('select * from public.lists') <= 0, 'anonymous users cannot read lists');
select ok(pg_temp.exec_count('select * from public.profiles') <= 0, 'anonymous users cannot read profiles');

reset role;
select * from finish();
rollback;
