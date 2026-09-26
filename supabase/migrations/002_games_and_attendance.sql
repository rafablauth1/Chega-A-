-- Vaia Aí: jogos, presença, convidados e caixa dentro do grupo.
-- Rode no Supabase: SQL Editor > New query > colar > Run.

-- Nota do jogador dada pelos admins do grupo (sobrepõe a autoavaliação do perfil)
alter table public.group_members add column if not exists skills jsonb;

-- Convidados: jogadores sem conta no app, cadastrados pelos admins
create table if not exists public.guests (
  id text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  nickname text,
  phone text,
  position text not null default 'MEI',
  type text not null default 'avulso',
  skills jsonb not null default '{"tecnica":3,"fisico":3,"passe":3,"finalizacao":3,"defesa":3}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  date text not null,
  location text not null default '',
  price_per_player numeric not null default 0,
  players_per_team int not null default 6,
  max_players int not null default 0,
  teams jsonb,
  matches jsonb not null default '[]',
  mvp text,
  paid jsonb not null default '[]',
  ratings jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists games_group_idx on public.games (group_id);

-- Presença: a ordem de chegada (created_at) define quem fica na lista de espera
create table if not exists public.attendance (
  game_id text not null references public.games (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (game_id, player_id)
);
create index if not exists attendance_group_idx on public.attendance (group_id);

create table if not exists public.expenses (
  id text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  date text not null,
  description text not null,
  amount numeric not null
);
create index if not exists expenses_group_idx on public.expenses (group_id);

create table if not exists public.monthly_payments (
  group_id uuid not null references public.groups (id) on delete cascade,
  month text not null,
  player_id text not null,
  primary key (group_id, month, player_id)
);

-- Regras de acesso: membros leem; admins escrevem; cada jogador marca a própria presença
create or replace function public.is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.group_role(gid) in ('owner', 'admin'), false);
$$;

alter table public.guests enable row level security;
alter table public.games enable row level security;
alter table public.attendance enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['guests', 'games', 'expenses', 'monthly_payments'] loop
    execute format('drop policy if exists "membros leem" on public.%I', t);
    execute format('create policy "membros leem" on public.%I for select using (public.group_role(group_id) is not null)', t);
    execute format('drop policy if exists "admins escrevem" on public.%I', t);
    execute format('create policy "admins escrevem" on public.%I for all using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id))', t);
  end loop;
end $$;

drop policy if exists "membros leem" on public.attendance;
create policy "membros leem" on public.attendance for select
  using (public.group_role(group_id) is not null);
drop policy if exists "confirmar presença" on public.attendance;
create policy "confirmar presença" on public.attendance for insert
  with check (
    exists (select 1 from public.games g where g.id = game_id and g.group_id = attendance.group_id)
    and (public.is_group_admin(group_id) or (player_id = auth.uid()::text and public.group_role(group_id) is not null))
  );
drop policy if exists "desconfirmar presença" on public.attendance;
create policy "desconfirmar presença" on public.attendance for delete
  using (public.is_group_admin(group_id) or player_id = auth.uid()::text);

-- Tempo real: o app recebe na hora as mudanças feitas por outros celulares
do $$
declare t text;
begin
  foreach t in array array['groups', 'group_members', 'guests', 'games', 'attendance', 'expenses', 'monthly_payments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
