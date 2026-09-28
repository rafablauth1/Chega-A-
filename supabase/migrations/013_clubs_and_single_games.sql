-- 013: clubes e jogos avulsos.
--
--  - groups.kind: 'clube' (a pelada fixa, com membros, caixa e, se quiser, mensalistas) ou
--    'avulso' (um jogo solto, sem clube: quem é convidado entra direto no jogo).
--  - Jogo avulso pode ser publicado no Bora (open_calls.game_id): quem topar entra no jogo na hora,
--    sem precisar do código.
--  - "Tem mensalista?" fica em groups.settings.monthlyEnabled (não precisa de coluna).
--
-- Rodar depois da 012. Pode rodar de novo sem problema.

alter table public.groups add column if not exists kind text not null default 'clube';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_kind_check') then
    alter table public.groups add constraint groups_kind_check check (kind in ('clube', 'avulso'));
  end if;
end $$;

alter table public.open_calls add column if not exists game_id text references public.games (id) on delete set null;

-- Segurança: vaga ligada a um clube/jogo só pode ser publicada por dono ou admin DAQUELE clube,
-- e o jogo tem que ser do mesmo clube (senão alguém abriria o jogo dos outros para desconhecidos).
create or replace function public.check_call_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and not public.is_group_admin(new.group_id) then
    raise exception 'only club admins can publish club games' using errcode = '42501';
  end if;
  if new.game_id is not null and not exists (select 1 from public.games where id = new.game_id and group_id = new.group_id) then
    raise exception 'game does not belong to this club' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists on_call_group_check on public.open_calls;
create trigger on_call_group_check before insert or update of group_id, game_id on public.open_calls
  for each row execute function public.check_call_group();

/**
 * Entrar no jogo publicado no Bora: vira membro do grupo do jogo (como jogador) e já confirma presença.
 * Mesmas regras do Bora: maior de 18, vaga aberta, sem bloqueio com quem publicou, jogo ainda não aconteceu.
 * Devolve o id do grupo.
 */
create or replace function public.join_call_game(cid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.open_calls;
  g public.games;
  confirmed int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.is_adult(me) then raise exception 'adults only'; end if;

  select * into c from public.open_calls where id = cid;
  if c.id is null or c.closed or c.group_id is null or c.game_id is null then raise exception 'call not joinable'; end if;
  if public.is_blocked(me, c.author) then raise exception 'call not joinable'; end if;

  select * into g from public.games where id = c.game_id and group_id = c.group_id;
  if g.id is null then raise exception 'call not joinable'; end if;
  if g.date < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI') then raise exception 'game already happened'; end if;

  -- Lotação: com limite de vagas, quem passar entra na lista de espera (como no app)
  select count(*) into confirmed from public.attendance where game_id = g.id;

  insert into public.group_members (group_id, user_id, role, type)
  values (c.group_id, me, 'player', 'avulso')
  on conflict do nothing;

  insert into public.attendance (game_id, group_id, player_id)
  values (g.id, c.group_id, me::text)
  on conflict do nothing;

  insert into public.call_responses (call_id, user_id) values (cid, me) on conflict do nothing;

  -- Lotou: fecha a vaga no Bora
  if g.max_players > 0 and confirmed + 1 >= g.max_players then
    update public.open_calls set closed = true where id = cid;
  end if;

  return c.group_id;
end $$;
revoke execute on function public.join_call_game(uuid) from public, anon;
grant execute on function public.join_call_game(uuid) to authenticated;

-- Anti-spam: no máximo 30 entradas em jogos por hora (usa a tabela call_responses)
-- (a trava rl de call_responses da 009 já cobre: 30 por hora)

-- Vagas perto de mim: agora dizendo se dá para entrar direto no jogo
drop function if exists public.calls_nearby(int);
create or replace function public.calls_nearby(radius_km int default 20)
returns table (
  id uuid, author uuid, author_name text, author_photo text, title text, date text, location text,
  positions text[], slots int, price numeric, notes text, neighborhood text, city text,
  distance_km int, responses int, i_responded boolean, mine boolean, joinable boolean, group_id uuid, game_id text
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
    c.author = me.id,
    c.game_id is not null and c.group_id is not null,
    c.group_id,
    c.game_id
  from me
  join public.open_calls c on not c.closed and c.lat_approx is not null
  join public.profiles a on a.id = c.author
  where c.date >= to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI')
    and (c.author = me.id or public.km_between(me.lat_approx, me.lng_approx, c.lat_approx, c.lng_approx) <= least(radius_km, 100))
    and not public.is_blocked(me.id, c.author)
  order by c.date
  limit 50;
$$;
revoke execute on function public.calls_nearby(int) from public, anon;
grant execute on function public.calls_nearby(int) to authenticated;
