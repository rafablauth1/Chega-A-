-- Vaia Aí: comunidades (empresa, escola, faculdade, condomínio, bairro...) com vários times dentro.
-- Cada time é um grupo normal (jogos, presença, caixa); a comunidade junta os times.
-- Rode no Supabase: SQL Editor > New query > colar > Run.

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 60),
  kind text not null default 'amigos'
    check (kind in ('empresa', 'escola', 'faculdade', 'condominio', 'bairro', 'amigos', 'outro')),
  description text check (length(description) <= 280),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on public.community_members (user_id);

-- Time (grupo) pertence a no máximo uma comunidade
alter table public.groups add column if not exists community_id uuid references public.communities (id) on delete set null;
create index if not exists groups_community_idx on public.groups (community_id);

-- Quem cria a comunidade vira dono
create or replace function public.handle_new_community()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;

drop trigger if exists on_community_created on public.communities;
create trigger on_community_created after insert on public.communities
  for each row execute function public.handle_new_community();

create or replace function public.community_role(cid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.community_members where community_id = cid and user_id = auth.uid();
$$;

-- Só pode colocar um time numa comunidade quem é membro dela
create or replace function public.check_group_community()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.community_id is not null
     and (tg_op = 'INSERT' or new.community_id is distinct from old.community_id)
     and public.community_role(new.community_id) is null then
    raise exception 'not a community member';
  end if;
  return new;
end $$;

drop trigger if exists on_group_community on public.groups;
create trigger on_group_community before insert or update of community_id on public.groups
  for each row execute function public.check_group_community();

-- Entrar na comunidade pelo código
create or replace function public.join_community(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into cid from public.communities where invite_code = upper(trim(code));
  if cid is null then raise exception 'invalid code'; end if;
  insert into public.community_members (community_id, user_id) values (cid, auth.uid())
    on conflict (community_id, user_id) do nothing;
  return cid;
end $$;

-- Membro da comunidade entra num time dela sem precisar do código do time
create or replace function public.join_community_group(gid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select community_id into cid from public.groups where id = gid;
  if cid is null or public.community_role(cid) is null then raise exception 'not a community member'; end if;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid())
    on conflict (group_id, user_id) do nothing;
  return gid;
end $$;

-- Painel da comunidade: cada time com membros, jogos e gols (sem abrir os dados internos do time)
create or replace function public.community_overview(cid uuid)
returns table (group_id uuid, name text, members int, games int, goals int, is_member boolean)
language sql stable security definer set search_path = public as $$
  select
    g.id,
    g.name,
    (select count(*) from public.group_members m where m.group_id = g.id)::int,
    (select count(*) from public.games ga
       where ga.group_id = g.id and ga.date <= to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'))::int,
    coalesce((
      select sum(jsonb_array_length(coalesce(mt -> 'goals', '[]'::jsonb)))
      from public.games ga, jsonb_array_elements(ga.matches) mt
      where ga.group_id = g.id
    ), 0)::int,
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from public.groups g
  where g.community_id = cid and public.community_role(cid) is not null
  order by g.name;
$$;

-- Artilharia da comunidade (todos os times)
create or replace function public.community_scorers(cid uuid, lim int default 10)
returns table (player_id text, name text, photo text, team text, goals int)
language sql stable security definer set search_path = public as $$
  with gl as (
    select goal ->> 'playerId' as pid, g.name as team
    from public.groups g
    join public.games ga on ga.group_id = g.id
    cross join lateral jsonb_array_elements(ga.matches) mt
    cross join lateral jsonb_array_elements(coalesce(mt -> 'goals', '[]'::jsonb)) goal
    where g.community_id = cid
      and public.community_role(cid) is not null
      and goal ->> 'playerId' is not null
      and coalesce((goal ->> 'ownGoal')::boolean, false) = false
  )
  select
    gl.pid,
    coalesce(p.nickname, p.name, gu.nickname, gu.name, 'Jogador'),
    p.photos[1],
    min(gl.team),
    count(*)::int
  from gl
  left join public.profiles p on p.id::text = gl.pid
  left join public.guests gu on gu.id = gl.pid
  group by gl.pid, p.nickname, p.name, gu.nickname, gu.name, p.photos
  order by count(*) desc
  limit greatest(1, least(lim, 50));
$$;

-- Regras de acesso (RLS)
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "communities: membros veem" on public.communities;
create policy "communities: membros veem" on public.communities for select
  using (owner_id = auth.uid() or public.community_role(id) is not null);
drop policy if exists "communities: qualquer usuário cria" on public.communities;
create policy "communities: qualquer usuário cria" on public.communities for insert
  with check (owner_id = auth.uid());
drop policy if exists "communities: admins editam" on public.communities;
create policy "communities: admins editam" on public.communities for update
  using (public.community_role(id) in ('owner', 'admin'));
drop policy if exists "communities: dono apaga" on public.communities;
create policy "communities: dono apaga" on public.communities for delete
  using (public.community_role(id) = 'owner');

drop policy if exists "community_members: membros veem" on public.community_members;
create policy "community_members: membros veem" on public.community_members for select
  using (public.community_role(community_id) is not null);
drop policy if exists "community_members: admins editam" on public.community_members;
create policy "community_members: admins editam" on public.community_members for update
  using (public.community_role(community_id) in ('owner', 'admin') and role <> 'owner')
  with check (role <> 'owner');
drop policy if exists "community_members: sair ou admin remove" on public.community_members;
create policy "community_members: sair ou admin remove" on public.community_members for delete
  using (role <> 'owner' and (user_id = auth.uid() or public.community_role(community_id) in ('owner', 'admin')));

-- Membros da comunidade enxergam o nome dos times dela (para escolher em qual entrar)
drop policy if exists "groups: membros da comunidade veem" on public.groups;
create policy "groups: membros da comunidade veem" on public.groups for select
  using (community_id is not null and public.community_role(community_id) is not null);

-- Membros da comunidade enxergam o perfil uns dos outros
drop policy if exists "profiles: membros da comunidade veem" on public.profiles;
create policy "profiles: membros da comunidade veem" on public.profiles for select
  using (exists (
    select 1 from public.community_members a
    join public.community_members b on a.community_id = b.community_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  ));

revoke all on function public.join_community(text) from public, anon;
revoke all on function public.join_community_group(uuid) from public, anon;
revoke all on function public.community_overview(uuid) from public, anon;
revoke all on function public.community_scorers(uuid, int) from public, anon;
grant execute on function public.join_community(text) to authenticated;
grant execute on function public.join_community_group(uuid) to authenticated;
grant execute on function public.community_overview(uuid) to authenticated;
grant execute on function public.community_scorers(uuid, int) to authenticated;

-- Excluir conta (substitui a da migração 004): também passa as comunidades para outro membro
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g record;
  heir uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  for g in select id from public.groups where owner_id = uid loop
    select user_id into heir from public.group_members
      where group_id = g.id and user_id <> uid
      order by (role = 'admin') desc, joined_at asc limit 1;
    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner_id = heir where id = g.id;
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
    end if;
  end loop;

  for g in select id from public.communities where owner_id = uid loop
    select user_id into heir from public.community_members
      where community_id = g.id and user_id <> uid
      order by (role = 'admin') desc, joined_at asc limit 1;
    if heir is null then
      delete from public.communities where id = g.id;
    else
      update public.communities set owner_id = heir where id = g.id;
      update public.community_members set role = 'owner' where community_id = g.id and user_id = heir;
    end if;
  end loop;

  delete from public.attendance where player_id = uid::text;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Tempo real para a lista de times e membros
do $$
declare t text;
begin
  foreach t in array array['communities', 'community_members'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
