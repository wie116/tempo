-- Tempo · esquema completo
-- Pegá TODO esto en el SQL Editor de tu proyecto Supabase y ejecutalo.
-- Es idempotente: podés correrlo de nuevo sin romper nada.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists lists (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#2F6F5E',
  sort_order int not null default 0,
  collapsed boolean not null default false,
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
  status text not null default 'planned' check (status in ('planned','done')),
  closed_at bigint,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists blocks_user_start_idx on blocks (user_id, starts_at);
create index if not exists tasks_user_list_idx on tasks (user_id, list_id);
create index if not exists lists_user_idx on lists (user_id);

-- Aislamiento por usuario: nadie ve datos de nadie.
alter table profiles enable row level security;
alter table lists    enable row level security;
alter table tasks    enable row level security;
alter table blocks   enable row level security;

drop policy if exists "profiles propios" on profiles;
create policy "profiles propios" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

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

-- Sincronización en vivo entre dispositivos
alter publication supabase_realtime add table lists;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table blocks;
