-- Vaia Aí: vincular um clube já existente a uma comunidade, com sincronia de membros.
-- Rodar depois da 016. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Hoje só dava pra criar um time do zero dentro da comunidade (groups.community_id ao inserir).
-- Agora também dá pra pegar um clube que já existe e apontar community_id pra uma comunidade
-- (a trava "not a community member" da migração 005 continua valendo: só quem já é da comunidade
-- pode fazer isso, e só o dono/admin do clube pode editar o clube).
--
-- Junto, dois gatilhos garantem: "quem é do clube, também é da comunidade"
--  1. Ao vincular o clube: todo mundo que já está nele entra na comunidade (dono do clube vira
--     ADMIN da comunidade — 1 admin por clube, sem contar o dono da comunidade; os demais, membro).
--  2. Dali em diante, quem entrar nesse clube também entra na comunidade automaticamente.
-- Sair do clube NÃO tira da comunidade (a pessoa pode estar em outro clube dela também).

create or replace function public.sync_group_to_community(gid uuid, cid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role)
  select cid, gm.user_id, case when gm.role = 'owner' then 'admin' else 'member' end
  from public.group_members gm
  where gm.group_id = gid
  on conflict (community_id, user_id) do nothing;
end $$;

create or replace function public.after_group_community_set()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.community_id is not null and (tg_op = 'INSERT' or new.community_id is distinct from old.community_id) then
    -- O dono do clube sempre vira admin da comunidade, mesmo criando o time na hora
    -- (nesse caso group_members ainda pode não ter a linha do dono neste ponto da transação).
    insert into public.community_members (community_id, user_id, role)
    values (new.community_id, new.owner_id, 'admin')
    on conflict (community_id, user_id) do nothing;
    perform public.sync_group_to_community(new.id, new.community_id);
  end if;
  return new;
end $$;

drop trigger if exists on_group_community_synced on public.groups;
create trigger on_group_community_synced after insert or update of community_id on public.groups
  for each row execute function public.after_group_community_set();

create or replace function public.after_group_member_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select community_id into cid from public.groups where id = new.group_id;
  if cid is not null then
    insert into public.community_members (community_id, user_id, role)
    values (cid, new.user_id, case when new.role = 'owner' then 'admin' else 'member' end)
    on conflict (community_id, user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_group_member_added_to_community on public.group_members;
create trigger on_group_member_added_to_community after insert on public.group_members
  for each row execute function public.after_group_member_added();

revoke execute on function public.sync_group_to_community(uuid, uuid) from public, anon, authenticated;
