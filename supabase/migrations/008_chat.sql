-- Vaia Aí: chat dentro do app (estilo Tinder). Depende da 007.
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- Quem pode conversar: quem deu match (os dois deram "bora") ou o dono de uma vaga do
-- "Falta gente!" com quem topou a vaga. Bloqueio encerra a conversa para os dois.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipient uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);
create index if not exists messages_pair_idx on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists messages_unread_idx on public.messages (recipient) where read_at is null;

-- Podem conversar?
create or replace function public.can_chat(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select a <> b
    and not public.is_blocked(a, b)
    and (
      -- match: os dois deram "bora"
      (exists (select 1 from public.swipes where from_user = a and to_user = b and liked)
        and exists (select 1 from public.swipes where from_user = b and to_user = a and liked))
      -- vaga do "Falta gente!": autor e quem topou
      or exists (
        select 1 from public.open_calls c join public.call_responses r on r.call_id = c.id
        where (c.author = a and r.user_id = b) or (c.author = b and r.user_id = a)
      )
    );
$$;

alter table public.messages enable row level security;

drop policy if exists "messages: os dois leem" on public.messages;
create policy "messages: os dois leem" on public.messages for select
  using (auth.uid() in (sender, recipient));

drop policy if exists "messages: enviar" on public.messages;
create policy "messages: enviar" on public.messages for insert
  with check (sender = auth.uid() and public.can_chat(sender, recipient));
-- Sem update/delete direto: marcar como lida é pela função abaixo

-- Marca como lidas as mensagens que o outro me mandou
create or replace function public.mark_read(other uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where recipient = auth.uid() and sender = other and read_at is null;
$$;

-- Quem conversa pode ver o perfil de atleta do outro
drop policy if exists "profiles: quem pode conversar vê" on public.profiles;
create policy "profiles: quem pode conversar vê" on public.profiles for select
  using (public.can_chat(auth.uid(), id));

-- Matches agora trazem a última mensagem e quantas não li (a função muda de formato, por isso o drop)
drop function if exists public.my_matches();
create or replace function public.my_matches()
returns table (
  id uuid, name text, nickname text, photo text, pos text, neighborhood text, city text,
  phone text, instagram text, matched_at timestamptz,
  last_message text, last_at timestamptz, last_from_me boolean, unread int
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.photos[1], p.position, p.neighborhood, p.city,
    case when p.share_contact then p.phone end,
    case when p.share_contact then p.instagram end,
    greatest(a.created_at, b.created_at),
    lm.body, lm.created_at, lm.sender = auth.uid(),
    (select count(*) from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null)::int
  from public.swipes a
  join public.swipes b on b.from_user = a.to_user and b.to_user = a.from_user and b.liked
  join public.profiles p on p.id = a.to_user
  left join lateral (
    select m.body, m.created_at, m.sender from public.messages m
    where (m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where a.from_user = auth.uid() and a.liked and not public.is_blocked(a.from_user, a.to_user)
  order by coalesce(lm.created_at, greatest(a.created_at, b.created_at)) desc;
$$;

-- Total de mensagens não lidas (para a bolinha na aba)
create or replace function public.unread_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.messages m
  where m.recipient = auth.uid() and m.read_at is null and not public.is_blocked(m.sender, m.recipient);
$$;

revoke all on function public.can_chat(uuid, uuid) from public, anon;
revoke all on function public.mark_read(uuid) from public, anon;
revoke all on function public.my_matches() from public, anon;
revoke all on function public.unread_count() from public, anon;
grant execute on function public.can_chat(uuid, uuid) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.my_matches() to authenticated;
grant execute on function public.unread_count() to authenticated;

-- Tempo real: mensagem nova chega na hora (o RLS garante que só os dois recebem)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
