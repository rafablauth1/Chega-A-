-- Vaia Aí: aceitar quem se interessou numa vaga ("Falta gente"), confirmando na partida.
-- Rodar depois da 017. Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Hoje quem publica uma vaga sem jogo ligado (group_id sem game_id) só via de conversar por
-- fora — não tinha um "Aceitar" que fizesse alguma coisa de verdade. Agora dono/admin do clube
-- aceitam um interessado escolhendo a partida: confirma a presença ali e, se for clube de
-- verdade (não jogo avulso), vira um PEDIDO de entrada no clube (não entra sozinho — o clube
-- aprova depois, na tela dele). Jogo avulso: entra direto, como o join_call_game já faz.

create table if not exists public.group_join_requests (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_join_requests enable row level security;

drop policy if exists "join_requests: admin ou o proprio ve" on public.group_join_requests;
create policy "join_requests: admin ou o proprio ve" on public.group_join_requests for select
  using (public.is_group_admin(group_id) or user_id = auth.uid());

revoke insert, update, delete on public.group_join_requests from authenticated, anon;

/** Aceita um interessado da vaga numa partida específica do clube/jogo. Só dono/admin do clube. */
create or replace function public.accept_call_responder(call_id uuid, responder uuid, gid text)
returns text language plpgsql security definer set search_path = public as $$
declare
  c public.open_calls;
  g public.games;
  k text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into c from public.open_calls where id = call_id;
  if c.id is null or c.group_id is null then raise exception 'call not found'; end if;
  if not public.is_group_admin(c.group_id) then raise exception 'only club admins can accept'; end if;

  select * into g from public.games where id = gid and group_id = c.group_id;
  if g.id is null then raise exception 'game does not belong to this club'; end if;

  insert into public.attendance (game_id, group_id, player_id) values (g.id, c.group_id, responder::text)
    on conflict do nothing;
  insert into public.call_responses (call_id, user_id) values (call_id, responder) on conflict do nothing;

  select kind into k from public.groups where id = c.group_id;

  if exists (select 1 from public.group_members where group_id = c.group_id and user_id = responder) then
    return 'confirmed';
  elsif k = 'avulso' then
    insert into public.group_members (group_id, user_id, role, type) values (c.group_id, responder, 'player', 'avulso')
      on conflict do nothing;
    return 'confirmed';
  else
    insert into public.group_join_requests (group_id, user_id, status, created_at) values (c.group_id, responder, 'pending', now())
      on conflict (group_id, user_id) do update set status = 'pending', created_at = now()
      where public.group_join_requests.status <> 'approved';
    return 'requested';
  end if;
end $$;

revoke execute on function public.accept_call_responder(uuid, uuid, text) from public, anon;
grant execute on function public.accept_call_responder(uuid, uuid, text) to authenticated;

/** Dono/admin do clube aprova ou recusa um pedido de entrada. */
create or replace function public.respond_join_request(gid uuid, target uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(gid) then raise exception 'only club admins can decide'; end if;
  if approve then
    insert into public.group_members (group_id, user_id, role, type) values (gid, target, 'player', 'avulso')
      on conflict do nothing;
    update public.group_join_requests set status = 'approved' where group_id = gid and user_id = target;
  else
    update public.group_join_requests set status = 'rejected' where group_id = gid and user_id = target;
  end if;
end $$;

revoke execute on function public.respond_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;

-- Tempo real: pedidos aparecem/somem na hora pra quem administra o clube
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_join_requests') then
    alter publication supabase_realtime add table public.group_join_requests;
  end if;
end $$;
