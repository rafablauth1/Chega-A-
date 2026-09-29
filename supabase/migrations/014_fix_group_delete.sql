-- Vaia Aí: corrige "Apagar grupo" travado para o dono.
-- Rodar depois da 013. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Bug: apagar o grupo (public.groups) dispara "on delete cascade" em
-- public.group_members, mas a política de DELETE de group_members exclui
-- explicitamente linhas com role = 'owner' (ela existe pra impedir que
-- admin remova o dono). Isso barra o próprio cascade e o DELETE inteiro
-- falha com erro de política, mesmo o dono tendo permissão em "groups".
--
-- Correção: uma função security definer (mesmo padrão de join_group e
-- delete_my_account) que confere se quem chama é o dono e apaga o grupo
-- passando por cima do RLS, igual já acontece hoje dentro de delete_my_account.

create or replace function public.delete_group(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.groups where id = gid and owner_id = auth.uid()) then
    raise exception 'not the owner';
  end if;
  delete from public.groups where id = gid;
end $$;

revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;
