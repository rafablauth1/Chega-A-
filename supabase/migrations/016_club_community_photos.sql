-- Vaia Aí: foto de perfil para clube e comunidade.
-- Rodar depois da 015. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Reaproveita o bucket público "avatars" (migração 003), só com pastas novas:
--   avatars/clubs/<group_id>/...         admin/dono do clube envia
--   avatars/communities/<community_id>/...  admin/dono da comunidade envia
-- A coluna "photo" já é gravável por quem edita o clube/comunidade (políticas de
-- UPDATE de groups/communities já liberam dono e admin); falta só a coluna e a
-- permissão de enviar o arquivo pra essas pastas do Storage.

alter table public.groups add column if not exists photo text;
alter table public.communities add column if not exists photo text;

drop policy if exists "avatars: clube/comunidade enviar" on storage.objects;
create policy "avatars: clube/comunidade enviar" on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (
      ((storage.foldername(name))[1] = 'clubs' and public.group_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
      or
      ((storage.foldername(name))[1] = 'communities' and public.community_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
    )
  );

drop policy if exists "avatars: clube/comunidade trocar" on storage.objects;
create policy "avatars: clube/comunidade trocar" on storage.objects for update
  using (
    bucket_id = 'avatars' and (
      ((storage.foldername(name))[1] = 'clubs' and public.group_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
      or
      ((storage.foldername(name))[1] = 'communities' and public.community_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
    )
  );

drop policy if exists "avatars: clube/comunidade apagar" on storage.objects;
create policy "avatars: clube/comunidade apagar" on storage.objects for delete
  using (
    bucket_id = 'avatars' and (
      ((storage.foldername(name))[1] = 'clubs' and public.group_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
      or
      ((storage.foldername(name))[1] = 'communities' and public.community_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
    )
  );
