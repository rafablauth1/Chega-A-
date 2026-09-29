-- Vaia Aí: dono também pode sair do clube (não só apagar).
-- Rodar depois da 014. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Hoje só quem não é dono tem "Sair" (delete direto em group_members funciona,
-- a política de RLS libera role <> 'owner'). O dono só tinha "Apagar", que destrói
-- o clube pra todo mundo. Esta função deixa o dono sair também: passa a
-- administração para outro membro (admin mais antigo, senão o mais antigo do
-- clube) e, se não houver mais ninguém, apaga o clube (mesma regra de heir já
-- usada em delete_my_account, migração 005).

create or replace function public.leave_group(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_role text;
  heir uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select role into my_role from public.group_members where group_id = gid and user_id = me;
  if my_role is null then raise exception 'not a member'; end if;

  if my_role = 'owner' then
    select user_id into heir from public.group_members
      where group_id = gid and user_id <> me
      order by (role = 'admin') desc, joined_at asc limit 1;
    if heir is null then
      delete from public.groups where id = gid;
      return;
    end if;
    update public.groups set owner_id = heir where id = gid;
    update public.group_members set role = 'owner' where group_id = gid and user_id = heir;
  end if;

  delete from public.group_members where group_id = gid and user_id = me;
end $$;

revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
