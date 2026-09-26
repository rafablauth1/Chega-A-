-- Vaia Aí: perfil de atleta completo (fotos e dados pessoais).
-- Rode no Supabase: SQL Editor > New query > colar > Run.

alter table public.profiles
  add column if not exists photos text[] not null default '{}',
  add column if not exists birth_date date,
  add column if not exists city text,
  add column if not exists bio text,
  add column if not exists foot text check (foot in ('D', 'E', 'A')),
  add column if not exists height_cm int check (height_cm between 100 and 250),
  add column if not exists weight_kg int check (weight_kg between 30 and 250),
  add column if not exists second_position text check (second_position in ('GOL', 'ZAG', 'MEI', 'ATA')),
  add column if not exists shirt_number int check (shirt_number between 0 and 99),
  add column if not exists favorite_team text,
  add column if not exists instagram text;

-- Fotos: pasta pública "avatars", cada usuário só mexe na própria pasta (avatars/<id do usuário>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars: ver" on storage.objects;
create policy "avatars: ver" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatars: enviar a própria" on storage.objects;
create policy "avatars: enviar a própria" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: trocar a própria" on storage.objects;
create policy "avatars: trocar a própria" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: apagar a própria" on storage.objects;
create policy "avatars: apagar a própria" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
