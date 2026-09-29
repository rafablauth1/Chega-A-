-- Vaia Aí: aceitar interessado entra direto na partida, sem pedido pendente.
-- Rodar depois da 018. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- A 018 fazia aceitar virar um "pedido de entrada" pendente quando o clube era de verdade
-- (kind = 'clube'). Na prática isso só atrapalha: aceitar já é a decisão do admin, não precisa
-- de uma segunda aprovação. Agora aceitar sempre confirma direto na partida E no clube (como
-- avulso — tipo type='avulso', igual já acontece com quem entra sozinho pelo Bora). Virar
-- mensalista ou não é combinado depois, fora daqui.

create or replace function public.accept_call_responder(call_id uuid, responder uuid, gid text)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.open_calls;
  g public.games;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into c from public.open_calls where id = call_id;
  if c.id is null or c.group_id is null then raise exception 'call not found'; end if;
  if not public.is_group_admin(c.group_id) then raise exception 'only club admins can accept'; end if;

  select * into g from public.games where id = gid and group_id = c.group_id;
  if g.id is null then raise exception 'game does not belong to this club'; end if;

  insert into public.group_members (group_id, user_id, role, type) values (c.group_id, responder, 'player', 'avulso')
    on conflict do nothing;
  insert into public.attendance (game_id, group_id, player_id) values (g.id, c.group_id, responder::text)
    on conflict do nothing;
  insert into public.call_responses (call_id, user_id) values (call_id, responder) on conflict do nothing;

  return 'confirmed';
end $$;
