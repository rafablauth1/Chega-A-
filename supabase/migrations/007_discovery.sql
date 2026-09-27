-- Vaia Aí: "Bora jogar?" (jogadores perto + match), "Falta gente!" (vagas abertas),
-- bloquear e denunciar. Depende da 006 (região).
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Regras (garantidas aqui no banco, não só no app):
--  * só vê jogadores perto quem também aparece (discoverable) e tem região salva;
--  * só maiores de 18 anos, dos dois lados;
--  * bloqueio vale nos dois sentidos e some de tudo;
--  * WhatsApp só aparece depois do match, e só se a pessoa autorizou (share_contact).

alter table public.profiles add column if not exists share_contact boolean not null default false;
-- Quando a pessoa costuma poder jogar: 'seg-noite', 'sab-manha'... (dia × turno)
alter table public.profiles add column if not exists availability text[] not null default '{}';

/* ------------------------------- Auxiliares ------------------------------- */

create or replace function public.is_adult(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select birth_date <= (current_date - interval '18 years') from public.profiles where id = uid), false);
$$;

-- Distância aproximada em km (Haversine)
create or replace function public.km_between(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1)::float8) / 2), 2) +
    cos(radians(lat1::float8)) * cos(radians(lat2::float8)) * power(sin(radians((lng2 - lng1)::float8) / 2), 2)
  ))::numeric;
$$;

/* -------------------------------- Bloqueios -------------------------------- */

create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

alter table public.blocks enable row level security;
drop policy if exists "blocks: os meus" on public.blocks;
create policy "blocks: os meus" on public.blocks for all
  using (blocker = auth.uid()) with check (blocker = auth.uid());

/* -------------------------------- Denúncias -------------------------------- */

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reported_user uuid references auth.users (id) on delete set null,
  call_id uuid,
  reason text not null check (reason in ('perfil_falso', 'ofensivo', 'assedio', 'golpe', 'menor_de_idade', 'outro')),
  details text check (length(details) <= 500),
  status text not null default 'aberta' check (status in ('aberta', 'analisada')),
  created_at timestamptz not null default now()
);

-- Quem denuncia só cria; ninguém lê pelo app (o dono analisa no painel do Supabase > Table Editor > reports)
alter table public.reports enable row level security;
drop policy if exists "reports: criar" on public.reports;
create policy "reports: criar" on public.reports for insert with check (reporter = auth.uid());

/* ------------------------------ Curtidas / match ------------------------------ */

create table if not exists public.swipes (
  from_user uuid not null references auth.users (id) on delete cascade default auth.uid(),
  to_user uuid not null references auth.users (id) on delete cascade,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists swipes_to_idx on public.swipes (to_user) where liked;

alter table public.swipes enable row level security;
drop policy if exists "swipes: os meus" on public.swipes;
create policy "swipes: os meus" on public.swipes for select using (from_user = auth.uid());
drop policy if exists "swipes: apagar os meus" on public.swipes;
create policy "swipes: apagar os meus" on public.swipes for delete using (from_user = auth.uid());
-- Inserir só pela função swipe(), que confere as regras

-- Jogadores perto de mim que ainda não avaliei
create or replace function public.players_nearby(radius_km int default 15, lim int default 30)
returns table (
  id uuid, name text, nickname text, photos text[], pos text, second_position text, foot text,
  shirt_number int, bio text, neighborhood text, city text, age int, distance_km int, availability text[]
)
language sql stable security definer set search_path = public as $$
  with me as (
    select id, lat_approx, lng_approx from public.profiles
    where id = auth.uid() and discoverable and lat_approx is not null and public.is_adult(auth.uid())
  )
  select p.id, p.name, p.nickname, p.photos, p.position, p.second_position, p.foot,
    p.shirt_number, p.bio, p.neighborhood, p.city,
    extract(year from age(p.birth_date))::int,
    greatest(1, round(public.km_between(me.lat_approx, me.lng_approx, p.lat_approx, p.lng_approx)))::int,
    p.availability
  from me
  join public.profiles p on p.id <> me.id
  where p.discoverable
    and p.lat_approx is not null
    and public.is_adult(p.id)
    -- caixa grosseira antes da conta exata (1 grau ~ 111 km)
    and p.lat_approx between me.lat_approx - (least(radius_km, 100) / 111.0) and me.lat_approx + (least(radius_km, 100) / 111.0)
    and public.km_between(me.lat_approx, me.lng_approx, p.lat_approx, p.lng_approx) <= least(radius_km, 100)
    and not public.is_blocked(me.id, p.id)
    and not exists (select 1 from public.swipes s where s.from_user = me.id and s.to_user = p.id)
  order by public.km_between(me.lat_approx, me.lng_approx, p.lat_approx, p.lng_approx), random()
  limit least(lim, 50);
$$;

-- Registra "bora" (liked) ou "passo"; devolve true quando deu match
create or replace function public.swipe(target uuid, liked_it boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_adult(uid) or not public.is_adult(target) then raise exception 'adults only'; end if;
  if public.is_blocked(uid, target) then raise exception 'blocked'; end if;
  insert into public.swipes (from_user, to_user, liked) values (uid, target, liked_it)
    on conflict (from_user, to_user) do update set liked = excluded.liked, created_at = now();
  return liked_it and exists (select 1 from public.swipes where from_user = target and to_user = uid and liked);
end $$;

-- Meus matches (os dois deram "bora"), com o contato de quem autorizou
create or replace function public.my_matches()
returns table (
  id uuid, name text, nickname text, photo text, pos text, neighborhood text, city text,
  phone text, instagram text, matched_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.photos[1], p.position, p.neighborhood, p.city,
    case when p.share_contact then p.phone end,
    case when p.share_contact then p.instagram end,
    greatest(a.created_at, b.created_at)
  from public.swipes a
  join public.swipes b on b.from_user = a.to_user and b.to_user = a.from_user and b.liked
  join public.profiles p on p.id = a.to_user
  where a.from_user = auth.uid() and a.liked and not public.is_blocked(a.from_user, a.to_user)
  order by greatest(a.created_at, b.created_at) desc;
$$;

/* ------------------------------ "Falta gente!" ------------------------------ */

create table if not exists public.open_calls (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users (id) on delete cascade default auth.uid(),
  group_id uuid references public.groups (id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 80),
  date text not null, -- YYYY-MM-DDTHH:mm (hora local)
  location text not null check (length(location) <= 120),
  positions text[] not null default '{}',
  slots int not null default 1 check (slots between 1 and 30),
  price numeric not null default 0 check (price >= 0),
  notes text check (length(notes) <= 300),
  neighborhood text,
  city text,
  lat_approx numeric(5, 2),
  lng_approx numeric(6, 2),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists open_calls_date_idx on public.open_calls (date) where not closed;

create table if not exists public.call_responses (
  call_id uuid not null references public.open_calls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (call_id, user_id)
);

alter table public.open_calls enable row level security;
alter table public.call_responses enable row level security;

drop policy if exists "calls: autor gerencia" on public.open_calls;
create policy "calls: autor gerencia" on public.open_calls for all
  using (author = auth.uid()) with check (author = auth.uid() and public.is_adult(auth.uid()));

drop policy if exists "responses: as minhas" on public.call_responses;
create policy "responses: as minhas" on public.call_responses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_adult(auth.uid()));

-- Vagas perto de mim (a partir de agora, abertas, sem bloqueio)
create or replace function public.calls_nearby(radius_km int default 20)
returns table (
  id uuid, author uuid, author_name text, author_photo text, title text, date text, location text,
  positions text[], slots int, price numeric, notes text, neighborhood text, city text,
  distance_km int, responses int, i_responded boolean, mine boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select id, lat_approx, lng_approx from public.profiles
    where id = auth.uid() and lat_approx is not null and public.is_adult(auth.uid())
  )
  select c.id, c.author, coalesce(a.nickname, a.name), a.photos[1], c.title, c.date, c.location,
    c.positions, c.slots, c.price, c.notes, c.neighborhood, c.city,
    greatest(1, round(public.km_between(me.lat_approx, me.lng_approx, c.lat_approx, c.lng_approx)))::int,
    (select count(*) from public.call_responses r where r.call_id = c.id)::int,
    exists (select 1 from public.call_responses r where r.call_id = c.id and r.user_id = me.id),
    c.author = me.id
  from me
  join public.open_calls c on not c.closed and c.lat_approx is not null
  join public.profiles a on a.id = c.author
  where c.date >= to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI')
    and (c.author = me.id or public.km_between(me.lat_approx, me.lng_approx, c.lat_approx, c.lng_approx) <= least(radius_km, 100))
    and not public.is_blocked(me.id, c.author)
  order by c.date
  limit 50;
$$;

-- Quem respondeu à minha vaga (só o autor vê), com contato de quem autorizou
create or replace function public.call_responders(cid uuid)
returns table (id uuid, name text, nickname text, photo text, pos text, neighborhood text, phone text, responded_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.photos[1], p.position, p.neighborhood,
    case when p.share_contact then p.phone end, r.created_at
  from public.call_responses r
  join public.open_calls c on c.id = r.call_id
  join public.profiles p on p.id = r.user_id
  where r.call_id = cid and c.author = auth.uid() and not public.is_blocked(c.author, p.id)
  order by r.created_at;
$$;

/* ------------------------------- Permissões ------------------------------- */

revoke all on function public.players_nearby(int, int) from public, anon;
revoke all on function public.swipe(uuid, boolean) from public, anon;
revoke all on function public.my_matches() from public, anon;
revoke all on function public.calls_nearby(int) from public, anon;
revoke all on function public.call_responders(uuid) from public, anon;
grant execute on function public.players_nearby(int, int) to authenticated;
grant execute on function public.swipe(uuid, boolean) to authenticated;
grant execute on function public.my_matches() to authenticated;
grant execute on function public.calls_nearby(int) to authenticated;
grant execute on function public.call_responders(uuid) to authenticated;
