-- 012: horário da quadra (início e fim) e duração das partidas; só o dono mexe em admin.
-- Rodar depois da 011. Pode rodar de novo sem problema.

-- ─── Horário da quadra ────────────────────────────────────────────────────────
-- games.date continua sendo o INÍCIO (YYYY-MM-DDTHH:mm). end_time é a hora de fim (HH:mm);
-- match_minutes é quanto dura cada partida (ex.: 3 partidas de 20 min numa hora de quadra).
alter table public.games add column if not exists end_time text;
alter table public.games add column if not exists match_minutes int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_end_time_format') then
    alter table public.games add constraint games_end_time_format
      check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_match_minutes_range') then
    alter table public.games add constraint games_match_minutes_range
      check (match_minutes is null or match_minutes between 1 and 360);
  end if;
end $$;

-- ─── Papéis no grupo: só o DONO dá/tira admin e remove admin ───────────────────
-- Admin continua podendo: mudar mensalista/avulso de jogador comum e remover jogador comum.
create or replace function public.guard_member_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me text := public.group_role(coalesce(new.group_id, old.group_id));
begin
  -- Painel do Supabase / funções do servidor (sem usuário logado): liberado
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  -- Grupo sendo apagado (apaga os membros em cascata): liberado
  if tg_op = 'DELETE' and not exists (select 1 from public.groups where id = old.group_id) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and me is distinct from 'owner' then
      raise exception 'only the group owner can change roles' using errcode = '42501';
    end if;
    -- Admin não mexe em outro admin
    if me = 'admin' and old.role = 'admin' and old.user_id <> auth.uid() then
      raise exception 'admins cannot edit other admins' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE: sair do grupo é sempre permitido; remover admin só o dono
  if old.user_id <> auth.uid() and old.role = 'admin' and me is distinct from 'owner' then
    raise exception 'only the group owner can remove admins' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists on_member_role_change on public.group_members;
create trigger on_member_role_change before update or delete on public.group_members
  for each row execute function public.guard_member_role();
