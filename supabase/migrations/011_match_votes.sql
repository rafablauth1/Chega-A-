-- 011: avaliação dos jogadores depois do jogo (estilo Cartola).
--
-- Regras (garantidas aqui no servidor, não só no app):
--  - Só dá para avaliar depois que o dono/admin ENCERRA o jogo (games.closed_at).
--  - Prazo: 24 horas depois de encerrado (muda em app_settings.vote_window_hours).
--  - Só vota quem jogou (está em um dos times) e só em quem jogou; ninguém vota em si mesmo.
--  - Cada um vê só os PRÓPRIOS votos. Para o grupo sai só a soma, separada em
--    "votos de companheiros" e "votos de adversários" (o app aplica os pesos 0,9 e 1,1).
--
-- Rodar depois da 010. Pode rodar de novo sem problema.

-- ─── Configurações gerais (editáveis no Table Editor) ─────────────────────────
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  vote_window_hours int not null default 24 check (vote_window_hours between 1 and 168),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "app_settings: leitura" on public.app_settings;
create policy "app_settings: leitura" on public.app_settings for select using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;

create or replace function public.vote_window_hours()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select vote_window_hours from public.app_settings where id), 24);
$$;

-- ─── Encerrar o jogo ──────────────────────────────────────────────────────────
alter table public.games add column if not exists closed_at timestamptz;

-- A hora do encerramento é a do SERVIDOR (o relógio do celular pode estar errado ou ser adiantado)
create or replace function public.stamp_game_closed()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.closed_at is not null and (tg_op = 'INSERT' or old.closed_at is null) then
    new.closed_at := now();
  elsif tg_op = 'UPDATE' and old.closed_at is not null and new.closed_at is not null then
    new.closed_at := old.closed_at; -- depois de encerrado, a hora não muda (não dá para esticar o prazo)
  end if;
  return new;
end $$;
drop trigger if exists on_game_closed on public.games;
create trigger on_game_closed before insert or update of closed_at on public.games
  for each row execute function public.stamp_game_closed();

-- Em qual time (0, 1, 2...) o jogador está; null se não jogou
create or replace function public.team_index(teams jsonb, pid text)
returns int language sql immutable as $$
  select (t.ord - 1)::int
  from jsonb_array_elements(case when jsonb_typeof(teams) = 'array' then teams else '[]'::jsonb end) with ordinality as t(team, ord)
  where jsonb_typeof(t.team) = 'array' and t.team ? pid
  limit 1;
$$;

-- ─── Votos ────────────────────────────────────────────────────────────────────
create table if not exists public.game_votes (
  game_id text not null references public.games (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  voter uuid not null references auth.users (id) on delete cascade,
  target text not null,
  score numeric(3, 1) not null check (score between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, voter, target)
);
create index if not exists game_votes_group_idx on public.game_votes (group_id);

-- Pode votar agora neste jogo, neste jogador?
create or replace function public.can_vote(gid text, grp uuid, target text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g
    where g.id = gid
      and g.group_id = grp
      and g.closed_at is not null
      and now() <= g.closed_at + make_interval(hours => public.vote_window_hours())
      and public.group_role(grp) is not null
      and public.team_index(g.teams, auth.uid()::text) is not null
      and public.team_index(g.teams, target) is not null
      and target <> auth.uid()::text
  );
$$;

alter table public.game_votes enable row level security;
drop policy if exists "votos: ver os meus" on public.game_votes;
create policy "votos: ver os meus" on public.game_votes for select using (voter = auth.uid());
drop policy if exists "votos: votar" on public.game_votes;
create policy "votos: votar" on public.game_votes for insert
  with check (voter = auth.uid() and public.can_vote(game_id, group_id, target));
drop policy if exists "votos: mudar dentro do prazo" on public.game_votes;
create policy "votos: mudar dentro do prazo" on public.game_votes for update
  using (voter = auth.uid() and public.can_vote(game_id, group_id, target))
  with check (voter = auth.uid() and public.can_vote(game_id, group_id, target));
revoke delete on public.game_votes from anon, authenticated;

create or replace function public.touch_vote()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists on_vote_update on public.game_votes;
create trigger on_vote_update before update on public.game_votes for each row execute function public.touch_vote();

/**
 * Soma dos votos de todos os jogos encerrados do grupo, por jogador avaliado.
 * Separa votos de companheiros (mesmo time) e de adversários. Nunca revela quem deu qual nota.
 */
create or replace function public.group_vote_totals(grp uuid)
returns table (game_id text, target text, own_sum numeric, own_n int, opp_sum numeric, opp_n int, voters int)
language sql stable security definer set search_path = public as $$
  with v as (
    select v.game_id, v.target, v.score, v.voter,
           public.team_index(g.teams, v.voter::text) = public.team_index(g.teams, v.target) as same_team
    from public.game_votes v
    join public.games g on g.id = v.game_id
    where v.group_id = grp and public.group_role(grp) is not null
  )
  select game_id, target,
         coalesce(sum(score) filter (where same_team), 0), (count(*) filter (where same_team))::int,
         coalesce(sum(score) filter (where not same_team), 0), (count(*) filter (where not same_team))::int,
         (select count(distinct voter)::int from v v2 where v2.game_id = v.game_id)
  from v
  group by game_id, target;
$$;
revoke execute on function public.group_vote_totals(uuid) from public, anon;
grant execute on function public.group_vote_totals(uuid) to authenticated;

-- Anti-spam (função rate_limit da 009): no máximo 400 votos por hora por pessoa
drop trigger if exists rate_limit_game_votes on public.game_votes;
create trigger rate_limit_game_votes before insert on public.game_votes
  for each row execute function public.rate_limit('voter', '1 hour', '400');
