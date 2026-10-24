-- Tempo Phase B: backward-compatible synchronization and lifecycle metadata.
--
-- This migration is additive. The current client continues using is_archived
-- and physical deletes until separately approved product and sync phases.

create temporary table tempo_phase_b_row_counts (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

insert into tempo_phase_b_row_counts (table_name, row_count) values
  ('profiles', (select count(*) from public.profiles)),
  ('lists', (select count(*) from public.lists)),
  ('tasks', (select count(*) from public.tasks)),
  ('blocks', (select count(*) from public.blocks));

alter table public.profiles
  add column if not exists revision bigint not null default 1,
  add column if not exists settings_version integer not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.lists
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.tasks
  add column if not exists revision bigint not null default 1,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.blocks
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_revision_positive'
  ) then
    alter table public.profiles
      add constraint profiles_revision_positive check (revision > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_settings_version_positive'
  ) then
    alter table public.profiles
      add constraint profiles_settings_version_positive check (settings_version > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lists'::regclass
      and conname = 'lists_revision_positive'
  ) then
    alter table public.lists
      add constraint lists_revision_positive check (revision > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_revision_positive'
  ) then
    alter table public.tasks
      add constraint tasks_revision_positive check (revision > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.blocks'::regclass
      and conname = 'blocks_revision_positive'
  ) then
    alter table public.blocks
      add constraint blocks_revision_positive check (revision > 0);
  end if;
end
$$;

create or replace function public.set_sync_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_sync_metadata on public.profiles;
create trigger profiles_set_sync_metadata
  before insert or update on public.profiles
  for each row execute function public.set_sync_metadata();

drop trigger if exists lists_set_sync_metadata on public.lists;
create trigger lists_set_sync_metadata
  before insert or update on public.lists
  for each row execute function public.set_sync_metadata();

drop trigger if exists tasks_set_sync_metadata on public.tasks;
create trigger tasks_set_sync_metadata
  before insert or update on public.tasks
  for each row execute function public.set_sync_metadata();

drop trigger if exists blocks_set_sync_metadata on public.blocks;
create trigger blocks_set_sync_metadata
  before insert or update on public.blocks
  for each row execute function public.set_sync_metadata();

do $$
begin
  if (select row_count from tempo_phase_b_row_counts where table_name = 'profiles')
      <> (select count(*) from public.profiles)
    or (select row_count from tempo_phase_b_row_counts where table_name = 'lists')
      <> (select count(*) from public.lists)
    or (select row_count from tempo_phase_b_row_counts where table_name = 'tasks')
      <> (select count(*) from public.tasks)
    or (select row_count from tempo_phase_b_row_counts where table_name = 'blocks')
      <> (select count(*) from public.blocks) then
    raise exception 'Phase B changed synchronized row counts; rolling back';
  end if;

  if exists (select 1 from public.profiles where revision <> 1 or settings_version <> 1)
    or exists (select 1 from public.lists where revision <> 1)
    or exists (select 1 from public.tasks where revision <> 1)
    or exists (select 1 from public.blocks where revision <> 1) then
    raise exception 'Phase B metadata backfill is invalid; rolling back';
  end if;

  if exists (select 1 from public.profiles where deleted_at is not null)
    or exists (select 1 from public.lists where deleted_at is not null)
    or exists (
      select 1 from public.tasks
      where completed_at is not null or archived_at is not null or deleted_at is not null
    )
    or exists (select 1 from public.blocks where deleted_at is not null) then
    raise exception 'Phase B activated lifecycle metadata unexpectedly; rolling back';
  end if;

  raise notice 'Tempo Phase B validated: profiles=%, lists=%, tasks=%, blocks=%',
    (select row_count from tempo_phase_b_row_counts where table_name = 'profiles'),
    (select row_count from tempo_phase_b_row_counts where table_name = 'lists'),
    (select row_count from tempo_phase_b_row_counts where table_name = 'tasks'),
    (select row_count from tempo_phase_b_row_counts where table_name = 'blocks');
end
$$;

comment on column public.profiles.settings_version is
  'Schema version for profiles.settings. Phase B starts at version 1.';
comment on column public.tasks.completed_at is
  'Reserved for the separately approved task lifecycle. Null during Phase B.';
comment on column public.tasks.archived_at is
  'Reserved for the separately approved task lifecycle. is_archived remains authoritative during Phase B.';
comment on column public.tasks.deleted_at is
  'Reserved tombstone. Physical delete behavior remains active during Phase B.';

notify pgrst, 'reload schema';
