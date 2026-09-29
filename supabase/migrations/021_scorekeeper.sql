-- 021: marcador do placar. Um admin por jogo marca gols, cronômetro e fim das partidas.
--
--  - games.scorekeeper: quem marca. Vazio = o primeiro admin que começar uma partida assume.
--  - Passar a vez: o marcador atual passa para outro admin; o DONO do clube também pode assumir
--    (ex.: acabou a bateria do celular do marcador).
--  - Só o marcador mexe no placar (games.matches). Se outro admin gravar o jogo com um placar
--    diferente (ex.: tela desatualizada), o servidor mantém o placar do marcador. Isso também evita
--    o "gol sumido" quando dois celulares salvam ao mesmo tempo.
--
-- Rodar depois da 020. Pode rodar de novo sem problema.

alter table public.games add column if not exists scorekeeper uuid references auth.users (id) on delete set null;

create or replace function public.guard_scorekeeper()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  is_owner boolean;
begin
  -- Painel do Supabase / funções do servidor: liberado
  if me is null then return new; end if;
  is_owner := public.group_role(new.group_id) = 'owner';

  if new.scorekeeper is distinct from old.scorekeeper then
    -- Com marcador definido, só ele (ou o dono) troca
    if old.scorekeeper is not null and old.scorekeeper <> me and not is_owner then
      new.scorekeeper := old.scorekeeper;
    -- O novo marcador tem que ser dono ou admin do clube
    elsif new.scorekeeper is not null and not exists (
      select 1 from public.group_members
      where group_id = new.group_id and user_id = new.scorekeeper and role in ('owner', 'admin')
    ) then
      new.scorekeeper := old.scorekeeper;
    end if;
  end if;

  -- Placar: com marcador definido, só ele mexe
  if new.matches is distinct from old.matches and old.scorekeeper is not null and old.scorekeeper <> me then
    new.matches := old.matches;
  end if;

  return new;
end $$;
revoke execute on function public.guard_scorekeeper() from public, anon, authenticated;

drop trigger if exists on_game_scorekeeper on public.games;
create trigger on_game_scorekeeper before update on public.games
  for each row execute function public.guard_scorekeeper();
