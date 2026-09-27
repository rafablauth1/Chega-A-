-- Vaia Aí: região do atleta (bairro/cidade pelo GPS) para achar jogadores perto.
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Privacidade: guardamos só o bairro e uma posição APROXIMADA. As colunas numeric(5,2)/(6,2)
-- arredondam para 2 casas decimais (~1 km), então o endereço exato nunca fica salvo,
-- mesmo que alguém tente mandar mais precisão.

alter table public.profiles
  add column if not exists neighborhood text check (length(neighborhood) <= 80),
  add column if not exists state text check (length(state) <= 40),
  add column if not exists lat_approx numeric(5, 2) check (lat_approx between -90 and 90),
  add column if not exists lng_approx numeric(6, 2) check (lng_approx between -180 and 180),
  add column if not exists region_updated_at timestamptz,
  -- Aparecer na busca de jogadores perto (desligado até a pessoa escolher)
  add column if not exists discoverable boolean not null default false;

create index if not exists profiles_discoverable_idx on public.profiles (discoverable) where discoverable;
