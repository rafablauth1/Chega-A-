-- Vaia Aí: contas, perfil de atleta e grupos.
-- Rode este arquivo inteiro no Supabase: painel do projeto > SQL Editor > New query > colar > Run.

-- Perfil de atleta: um por usuário (id = auth.users.id)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  nickname text,
  phone text,
  position text not null default 'MEI' check (position in ('GOL', 'ZAG', 'MEI', 'ATA')),
  skills jsonb not null default '{"tecnica":3,"fisico":3,"passe":3,"finalizacao":3,"defesa":3}',
  created_at timestamptz not null default now()
);

-- Grupo = uma pelada (ex.: "Pelada de quinta")
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('owner', 'admin', 'player')),
  type text not null default 'avulso' check (type in ('mensalista', 'avulso')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem cria o grupo vira dono automaticamente
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role, type) values (new.id, new.owner_id, 'owner', 'mensalista');
  return new;
end $$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created after insert on public.groups
  for each row execute function public.handle_new_group();

-- Funções auxiliares para as regras de acesso (security definer evita recursão no RLS)
create or replace function public.group_role(gid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.group_members where group_id = gid and user_id = auth.uid();
$$;

create or replace function public.shares_group(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Entrar num grupo pelo código de convite
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into gid from public.groups where invite_code = upper(trim(code));
  if gid is null then raise exception 'invalid code'; end if;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid())
    on conflict (group_id, user_id) do nothing;
  return gid;
end $$;

-- Regras de acesso (RLS)
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "profiles: ver o próprio e de colegas" on public.profiles;
create policy "profiles: ver o próprio e de colegas" on public.profiles for select
  using (id = auth.uid() or public.shares_group(id));
drop policy if exists "profiles: editar o próprio" on public.profiles;
create policy "profiles: editar o próprio" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "groups: membros veem" on public.groups;
create policy "groups: membros veem" on public.groups for select
  using (owner_id = auth.uid() or public.group_role(id) is not null);
drop policy if exists "groups: qualquer usuário cria" on public.groups;
create policy "groups: qualquer usuário cria" on public.groups for insert
  with check (owner_id = auth.uid());
drop policy if exists "groups: admins editam" on public.groups;
create policy "groups: admins editam" on public.groups for update
  using (public.group_role(id) in ('owner', 'admin'));
drop policy if exists "groups: dono apaga" on public.groups;
create policy "groups: dono apaga" on public.groups for delete
  using (public.group_role(id) = 'owner');

drop policy if exists "members: membros veem" on public.group_members;
create policy "members: membros veem" on public.group_members for select
  using (public.group_role(group_id) is not null);
drop policy if exists "members: admins editam" on public.group_members;
create policy "members: admins editam" on public.group_members for update
  using (public.group_role(group_id) in ('owner', 'admin') and role <> 'owner')
  with check (role <> 'owner');
drop policy if exists "members: sair ou admin remove" on public.group_members;
create policy "members: sair ou admin remove" on public.group_members for delete
  using (
    role <> 'owner'
    and (user_id = auth.uid() or public.group_role(group_id) in ('owner', 'admin'))
  );
