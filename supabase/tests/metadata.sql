begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(20);

select has_column('public', 'profiles', 'revision', 'profiles has a revision');
select has_column('public', 'profiles', 'settings_version', 'profiles settings are versioned');
select has_column('public', 'profiles', 'deleted_at', 'profiles has a tombstone');
select has_column('public', 'lists', 'revision', 'lists have a revision');
select has_column('public', 'lists', 'deleted_at', 'lists have a tombstone');
select has_column('public', 'tasks', 'revision', 'tasks have a revision');
select has_column('public', 'tasks', 'completed_at', 'tasks have completion metadata');
select has_column('public', 'tasks', 'archived_at', 'tasks have archive metadata');
select has_column('public', 'tasks', 'deleted_at', 'tasks have a tombstone');
select has_column('public', 'blocks', 'revision', 'blocks have a revision');
select has_column('public', 'blocks', 'deleted_at', 'blocks have a tombstone');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'authenticated', 'authenticated', 'metadata@tempo.invalid', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into public.lists (id, user_id, name, revision) values (
  'c1000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Metadata list',
  999
);

insert into public.tasks (id, user_id, list_id, title, is_archived) values (
  'c2000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'c1000000-0000-4000-8000-000000000001',
  'Metadata task',
  true
);

insert into public.blocks (id, user_id, task_id, title, starts_at, duration_min) values (
  'c3000000-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'c2000000-0000-4000-8000-000000000001',
  'Metadata block',
  '2026-10-21T09:00',
  30
);

select is(
  (select revision from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  1::bigint,
  'new profiles start at revision 1'
);
select is(
  (select settings_version from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  1,
  'new profiles start at settings version 1'
);
select is(
  (select revision from public.lists where id = 'c1000000-0000-4000-8000-000000000001'),
  1::bigint,
  'inserted revision values are normalized to 1'
);
select is(
  (select revision from public.tasks where id = 'c2000000-0000-4000-8000-000000000001'),
  1::bigint,
  'new tasks start at revision 1'
);
select ok(
  (select completed_at is null and archived_at is null and deleted_at is null
   from public.tasks where id = 'c2000000-0000-4000-8000-000000000001'),
  'legacy is_archived does not activate new lifecycle metadata'
);
select is(
  (select revision from public.blocks where id = 'c3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'new blocks start at revision 1'
);

create temporary table metadata_before_update as
select updated_at
from public.lists
where id = 'c1000000-0000-4000-8000-000000000001';

update public.lists
set name = 'Metadata list updated', revision = 999
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select revision from public.lists where id = 'c1000000-0000-4000-8000-000000000001'),
  2::bigint,
  'updates increment revision and ignore client-supplied values'
);
select ok(
  (select l.updated_at > b.updated_at
   from public.lists l cross join metadata_before_update b
   where l.id = 'c1000000-0000-4000-8000-000000000001'),
  'updates advance updated_at on the server'
);
select ok(
  (select deleted_at is null
   from public.lists where id = 'c1000000-0000-4000-8000-000000000001'),
  'metadata does not activate soft deletion'
);

select * from finish();
rollback;
