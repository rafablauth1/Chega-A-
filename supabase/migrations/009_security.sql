-- Vaia Aí: endurecimento de segurança e privacidade. Depende da 008.
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- O que muda (ver SEGURANCA.md):
--  1. Perfil: ninguém lê colunas sensíveis dos outros direto da tabela. O próprio perfil vem
--     por my_profile(); o dos outros por people(), que decide campo a campo o que mostrar.
--  2. Membros de comunidade deixam de ler os ajustes (Pix, código) dos outros times.
--  3. Telefone de convidado: só dono/admin do grupo.
--  4. Limites de uso (anti-spam) em mensagens, curtidas, vagas, denúncias e criação de grupos.
--  5. Limites de tamanho nos textos do perfil.
--  6. "Baixar meus dados" (portabilidade, LGPD art. 18).

/* ------------------------- 1. Perfil: leitura por colunas ------------------------- */

-- Tira o SELECT da tabela inteira e devolve só as colunas que qualquer pessoa autorizada
-- (colega de grupo/comunidade/conversa, pelo RLS) pode ver.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, name, nickname, position, second_position, skills, photos, bio, foot, height_cm,
  shirt_number, favorite_team, city, neighborhood, state, availability, created_at
) on public.profiles to authenticated;
-- Colunas privadas (sem SELECT para os outros): phone, instagram, birth_date, weight_kg,
-- lat_approx, lng_approx, discoverable, share_contact, region_updated_at.

-- Meu perfil completo
create or replace function public.my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

-- Posso ver o perfil (básico) de outra pessoa?
create or replace function public.can_see_profile(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or (not public.is_blocked(auth.uid(), target) and (
      public.shares_group(target)
      or exists (
        select 1 from public.community_members a
        join public.community_members b on a.community_id = b.community_id
        where a.user_id = auth.uid() and b.user_id = target
      )
      or public.can_chat(auth.uid(), target)
    ));
$$;

-- Sou dono/admin de algum grupo em que a pessoa joga? (organizador precisa do contato)
create or replace function public.manages(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid() and me.role in ('owner', 'admin') and them.user_id = target
  );
$$;

-- Porta única para ler perfis de outras pessoas, com idade (não a data de nascimento)
-- e contato só para quem pode: o próprio, o organizador dos grupos dela, ou quem conversa
-- com ela se ela liberou (share_contact).
create or replace function public.people(ids uuid[])
returns table (
  id uuid, name text, nickname text, pos text, second_position text, skills jsonb, photos text[],
  bio text, foot text, height_cm int, shirt_number int, favorite_team text, city text,
  neighborhood text, state text, availability text[], age int, phone text, instagram text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.nickname, p.position, p.second_position, p.skills, p.photos,
    p.bio, p.foot, p.height_cm, p.shirt_number, p.favorite_team, p.city,
    p.neighborhood, p.state, p.availability,
    case when p.birth_date is not null then extract(year from age(p.birth_date))::int end,
    case when p.id = auth.uid() or public.manages(p.id) or (p.share_contact and public.can_chat(auth.uid(), p.id)) then p.phone end,
    case when p.id = auth.uid() or public.manages(p.id) or (p.share_contact and public.can_chat(auth.uid(), p.id)) then p.instagram end
  from public.profiles p
  where p.id = any(ids[1:500]) and public.can_see_profile(p.id);
$$;

/* --------------------- 2. Comunidade não lê ajustes dos times --------------------- */

-- O painel da comunidade usa community_overview(); o acesso direto à tabela groups expunha
-- settings (chave Pix, valores) e o código de convite de todos os times.
drop policy if exists "groups: membros da comunidade veem" on public.groups;

/* ------------------------- 3. Telefone de convidado ------------------------- */

revoke select on public.guests from anon, authenticated;
grant select (id, group_id, name, nickname, position, type, skills, active, created_at) on public.guests to authenticated;

create or replace function public.guest_contacts(gid uuid)
returns table (id text, phone text)
language sql stable security definer set search_path = public as $$
  select g.id, g.phone from public.guests g
  where g.group_id = gid and public.is_group_admin(gid);
$$;

/* ----------------------------- 4. Limites de uso ----------------------------- */

-- Trigger genérico: tg_argv = (coluna do usuário, janela, máximo)
create or replace function public.rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text := to_jsonb(new) ->> tg_argv[0];
  n int;
begin
  execute format('select count(*) from %I.%I where %I::text = $1 and created_at > now() - $2::interval',
    tg_table_schema, tg_table_name, tg_argv[0])
    into n using who, tg_argv[1];
  if n >= tg_argv[2]::int then
    raise exception 'rate limit' using hint = format('Máximo de %s em %s', tg_argv[2], tg_argv[1]);
  end if;
  return new;
end $$;

drop trigger if exists rl_messages_min on public.messages;
create trigger rl_messages_min before insert on public.messages for each row execute function public.rate_limit('sender', '1 minute', '20');
drop trigger if exists rl_messages_day on public.messages;
create trigger rl_messages_day before insert on public.messages for each row execute function public.rate_limit('sender', '1 day', '1000');
drop trigger if exists rl_swipes on public.swipes;
create trigger rl_swipes before insert on public.swipes for each row execute function public.rate_limit('from_user', '1 day', '300');
drop trigger if exists rl_calls on public.open_calls;
create trigger rl_calls before insert on public.open_calls for each row execute function public.rate_limit('author', '1 day', '5');
drop trigger if exists rl_responses on public.call_responses;
create trigger rl_responses before insert on public.call_responses for each row execute function public.rate_limit('user_id', '1 hour', '30');
drop trigger if exists rl_reports on public.reports;
create trigger rl_reports before insert on public.reports for each row execute function public.rate_limit('reporter', '1 day', '20');
drop trigger if exists rl_groups on public.groups;
create trigger rl_groups before insert on public.groups for each row execute function public.rate_limit('owner_id', '1 day', '10');
drop trigger if exists rl_communities on public.communities;
create trigger rl_communities before insert on public.communities for each row execute function public.rate_limit('owner_id', '1 day', '5');

/* --------------------------- 5. Tamanho dos textos --------------------------- */

do $$
declare c record;
begin
  for c in select * from (values
    ('profiles_name_len', 'length(name) <= 60'),
    ('profiles_nickname_len', 'length(nickname) <= 30'),
    ('profiles_phone_len', 'length(phone) <= 25'),
    ('profiles_bio_len', 'length(bio) <= 300'),
    ('profiles_city_len', 'length(city) <= 80'),
    ('profiles_team_len', 'length(favorite_team) <= 60'),
    ('profiles_instagram_len', 'length(instagram) <= 40'),
    ('profiles_photos_max', 'coalesce(array_length(photos, 1), 0) <= 6'),
    ('profiles_availability_max', 'coalesce(array_length(availability, 1), 0) <= 21')
  ) as t(name, expr) loop
    execute format('alter table public.profiles drop constraint if exists %I', c.name);
    -- not valid: vale para o que for salvo daqui para frente, sem travar dados antigos
    execute format('alter table public.profiles add constraint %I check (%s) not valid', c.name, c.expr);
  end loop;
end $$;

/* ------------------------ 6. Baixar meus dados (LGPD) ------------------------ */

create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'email', (select email from auth.users where id = auth.uid()),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('grupo', g.name, 'papel', m.role, 'tipo', m.type, 'desde', m.joined_at)), '[]')
               from public.group_members m join public.groups g on g.id = m.group_id where m.user_id = auth.uid()),
    'comunidades', (select coalesce(jsonb_agg(jsonb_build_object('comunidade', c.name, 'papel', m.role, 'desde', m.joined_at)), '[]')
                    from public.community_members m join public.communities c on c.id = m.community_id where m.user_id = auth.uid()),
    'presencas', (select coalesce(jsonb_agg(jsonb_build_object('jogo', a.game_id, 'confirmado_em', a.created_at)), '[]')
                  from public.attendance a where a.player_id = auth.uid()::text),
    'curtidas', (select coalesce(jsonb_agg(jsonb_build_object('para', s.to_user, 'bora', s.liked, 'em', s.created_at)), '[]')
                 from public.swipes s where s.from_user = auth.uid()),
    'mensagens', (select coalesce(jsonb_agg(jsonb_build_object('de', m.sender, 'para', m.recipient, 'texto', m.body, 'em', m.created_at)), '[]')
                  from public.messages m where auth.uid() in (m.sender, m.recipient)),
    'vagas', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.open_calls c where c.author = auth.uid()),
    'bloqueios', (select coalesce(jsonb_agg(jsonb_build_object('bloqueado', b.blocked, 'em', b.created_at)), '[]')
                  from public.blocks b where b.blocker = auth.uid()),
    'denuncias_feitas', (select coalesce(jsonb_agg(jsonb_build_object('motivo', r.reason, 'em', r.created_at)), '[]')
                         from public.reports r where r.reporter = auth.uid())
  );
$$;

/* ------------------------------- Permissões ------------------------------- */

revoke all on function public.my_profile() from public, anon;
revoke all on function public.can_see_profile(uuid) from public, anon;
revoke all on function public.manages(uuid) from public, anon;
revoke all on function public.people(uuid[]) from public, anon;
revoke all on function public.guest_contacts(uuid) from public, anon;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;
grant execute on function public.manages(uuid) to authenticated;
grant execute on function public.people(uuid[]) to authenticated;
grant execute on function public.guest_contacts(uuid) to authenticated;
grant execute on function public.export_my_data() to authenticated;

-- Funções internas não precisam ser chamadas pelo app
revoke all on function public.rate_limit() from public, anon, authenticated;
