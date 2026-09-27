-- Vaia Aí: excluir a própria conta (exigência do Google Play e direito do titular na LGPD).
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- O que acontece:
--  * grupos em que a pessoa é dona e tem outros membros passam para um admin (ou o membro mais antigo);
--    grupos em que ela está sozinha são apagados;
--  * a presença dela nos jogos é removida;
--  * perfil e participação nos grupos saem junto com o usuário (on delete cascade);
--  * as fotos são apagadas pelo app antes de chamar esta função (o Supabase não deixa apagar
--    arquivos do Storage direto pelo SQL).
-- Gols, notas e placares antigos continuam nos jogos do grupo, mas sem nome ligado a eles.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g record;
  heir uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  for g in select id from public.groups where owner_id = uid loop
    select user_id into heir
      from public.group_members
      where group_id = g.id and user_id <> uid
      order by (role = 'admin') desc, joined_at asc
      limit 1;
    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set owner_id = heir where id = g.id;
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
    end if;
  end loop;

  delete from public.attendance where player_id = uid::text;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
