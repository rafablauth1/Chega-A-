-- 010: senha e redefinição com conferência no servidor.
--
-- O que muda:
--  1. Cadastro grava a data de nascimento no perfil (vinda do app).
--  2. "Esqueci minha senha": depois do código do e-mail, o servidor confere a DATA DE NASCIMENTO.
--     Sem acertar, o banco RECUSA a troca de senha, mesmo que alguém chame a API direto.
--     Até 5 tentativas por dia; depois bloqueia até o dia seguinte.
--  3. Troca de senha logado: o servidor só libera se a pessoa digitou a senha atual há menos de 5 minutos.
--  4. Tabela security_settings: liga/desliga regras sem mexer em código (Table Editor).
--
-- Rodar depois da 009. Pode rodar de novo sem problema.

-- ─── 1. Configurações editáveis pelo painel ─────────────────────────────────────
create table if not exists public.security_settings (
  id boolean primary key default true check (id),       -- uma linha só
  reset_requires_birthdate boolean not null default true,
  reset_max_attempts int not null default 5 check (reset_max_attempts between 1 and 20),
  reauth_minutes int not null default 5 check (reauth_minutes between 1 and 60),
  updated_at timestamptz not null default now()
);
insert into public.security_settings (id) values (true) on conflict (id) do nothing;

alter table public.security_settings enable row level security;
-- Todos (inclusive sem login) podem LER: o app precisa saber se pede a data na tela de redefinição.
-- Ninguém escreve pela API; só o dono, pelo painel.
drop policy if exists "security_settings: leitura" on public.security_settings;
create policy "security_settings: leitura" on public.security_settings for select using (true);
revoke insert, update, delete on public.security_settings from anon, authenticated;
grant select on public.security_settings to anon, authenticated;

-- ─── 2. Cadastro: nascimento vai para o perfil ─────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bd date;
begin
  begin
    bd := nullif(new.raw_user_meta_data ->> 'birth_date', '')::date;
  exception when others then
    bd := null;
  end;
  if bd is not null and (bd > current_date or bd < date '1900-01-01') then
    bd := null;
  end if;

  insert into public.profiles (id, name, birth_date)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), bd)
  on conflict (id) do nothing;
  return new;
end $$;

-- ─── 3. Controle de trocas de senha ────────────────────────────────────────────
-- Autorização de uso único, válida por 15 minutos, criada só pelas funções abaixo.
create table if not exists public.password_tickets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null check (reason in ('recovery', 'reauth')),
  expires_at timestamptz not null
);
-- Tentativas de conferir a data de nascimento (anti-chute)
create table if not exists public.reset_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists reset_attempts_user_time on public.reset_attempts (user_id, created_at desc);
-- Quando cada pessoa trocou a senha pela última vez
create table if not exists public.password_changes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  changed_at timestamptz not null default now()
);

-- Ninguém lê nem escreve essas tabelas pela API (só as funções security definer)
alter table public.password_tickets enable row level security;
alter table public.reset_attempts enable row level security;
alter table public.password_changes enable row level security;
revoke all on public.password_tickets, public.reset_attempts, public.password_changes from anon, authenticated;

-- Há um pedido de "esqueci a senha" ainda não concluído?
create or replace function public.recovery_pending(uid uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select u.recovery_sent_at is not null
       and u.recovery_sent_at > coalesce((select changed_at from public.password_changes c where c.user_id = u.id), '-infinity'::timestamptz)
    from auth.users u where u.id = uid
  ), false);
$$;
revoke execute on function public.recovery_pending(uuid) from public, anon, authenticated;

/**
 * Passo da redefinição: depois de entrar com o código do e-mail, o app manda a data de nascimento.
 * Devolve 'ok', 'wrong' (errou), 'locked' (errou demais hoje) ou 'no_recovery' (não há pedido aberto).
 */
create or replace function public.verify_reset_identity(birth date)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cfg public.security_settings;
  real_birth date;
  fails int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into cfg from public.security_settings where id;
  -- Pedido aberto (recovery_sent_at) ou sessão que acabou de entrar pelo código do e-mail
  if not public.recovery_pending(me) and not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('recovery', 'otp')
      and to_timestamp((a ->> 'timestamp')::bigint) > now() - interval '30 minutes'
  ) then
    return 'no_recovery';
  end if;

  select count(*) into fails from public.reset_attempts
  where user_id = me and not ok and created_at > now() - interval '24 hours';
  if fails >= coalesce(cfg.reset_max_attempts, 5) then return 'locked'; end if;

  select birth_date into real_birth from public.profiles where id = me;
  -- Regra desligada no painel, ou conta antiga sem data cadastrada: vale só o código do e-mail
  if coalesce(cfg.reset_requires_birthdate, true) and real_birth is not null and real_birth is distinct from birth then
    insert into public.reset_attempts (user_id, ok) values (me, false);
    return case when fails + 1 >= coalesce(cfg.reset_max_attempts, 5) then 'locked' else 'wrong' end;
  end if;

  insert into public.reset_attempts (user_id, ok) values (me, true);
  insert into public.password_tickets (user_id, reason, expires_at) values (me, 'recovery', now() + interval '15 minutes')
  on conflict (user_id) do update set reason = excluded.reason, expires_at = excluded.expires_at;
  return 'ok';
end $$;
revoke execute on function public.verify_reset_identity(date) from public, anon;
grant execute on function public.verify_reset_identity(date) to authenticated;

/**
 * Troca de senha logado: o app acabou de conferir a senha atual (novo login).
 * O servidor confirma pelo próprio token: método "password" usado há menos de N minutos.
 */
create or replace function public.password_change_ticket()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mins int := coalesce((select reauth_minutes from public.security_settings where id), 5);
  recent boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = 'password'
      and to_timestamp((a ->> 'timestamp')::bigint) > now() - make_interval(mins => mins)
  ) into recent;
  if not recent then return false; end if;
  insert into public.password_tickets (user_id, reason, expires_at) values (me, 'reauth', now() + interval '15 minutes')
  on conflict (user_id) do update set reason = excluded.reason, expires_at = excluded.expires_at;
  return true;
end $$;
revoke execute on function public.password_change_ticket() from public, anon;
grant execute on function public.password_change_ticket() to authenticated;

-- ─── 4. A trava: o banco recusa troca de senha sem autorização ─────────────────
-- Vale quando há um "esqueci a senha" aberto (é aí que um invasor com acesso ao e-mail tentaria).
-- Troca logado normal continua protegida pelo app (senha atual) e pelo "Secure password change" do Supabase.
create or replace function public.guard_password_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  t public.password_tickets;
begin
  if new.encrypted_password is not distinct from old.encrypted_password then return new; end if;
  -- Primeira senha (conta criada por convite/link): nada a proteger
  if coalesce(old.encrypted_password, '') = '' then return new; end if;

  select * into t from public.password_tickets where user_id = new.id and expires_at > now();

  if public.recovery_pending(new.id)
     and coalesce((select reset_requires_birthdate from public.security_settings where id), true)
     and t.user_id is null then
    raise exception 'password change requires identity check' using errcode = '42501';
  end if;

  delete from public.password_tickets where user_id = new.id;
  insert into public.password_changes (user_id, changed_at) values (new.id, now())
  on conflict (user_id) do update set changed_at = now();
  return new;
end $$;
revoke execute on function public.guard_password_change() from public, anon, authenticated;

drop trigger if exists on_auth_password_change on auth.users;
create trigger on_auth_password_change before update of encrypted_password on auth.users
  for each row execute function public.guard_password_change();

-- ─── 5. Exportar dados (LGPD): incluir o histórico de segurança da própria pessoa ─
-- (a export_my_data da 009 continua valendo; aqui só uma consulta extra, opcional)
create or replace function public.my_security_log()
returns table (kind text, at timestamptz) language sql stable security definer set search_path = public as $$
  select 'senha alterada', changed_at from public.password_changes where user_id = auth.uid()
  union all
  select case when ok then 'redefinição: data conferida' else 'redefinição: data errada' end, created_at
  from public.reset_attempts where user_id = auth.uid()
  order by 2 desc;
$$;
revoke execute on function public.my_security_log() from public, anon;
grant execute on function public.my_security_log() to authenticated;
