-- Tempo · esquema para la Fase 4 (Supabase)
-- Pegá esto en el SQL Editor de tu proyecto y ejecutalo.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#2F6F5E',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  list_id uuid references lists on delete cascade,
  title text not null,
  estimated_min int not null default 30,
  is_recurring boolean not null default false,
  is_archived boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid references tasks on delete set null,
  title text not null,
  color text not null default '#2F6F5E',
  starts_at timestamptz not null,
  duration_min int not null check (duration_min >= 10),
  kind text not null default 'task' check (kind in ('task','break','adhoc')),
  status text not null default 'planned' check (status in ('planned','done')),
  series_id uuid,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  block_id uuid references blocks on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  focus_min int,
  interrupted boolean not null default false
);

create index if not exists blocks_user_start_idx on blocks (user_id, starts_at);
create index if not exists tasks_user_list_idx on tasks (user_id, list_id);

-- Aislamiento por usuario: nadie ve datos de nadie.
alter table profiles enable row level security;
alter table lists    enable row level security;
alter table tasks    enable row level security;
alter table blocks   enable row level security;
alter table sessions enable row level security;

create policy "profiles propios" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "lists propias" on lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks propias" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "blocks propios" on blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions propias" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
