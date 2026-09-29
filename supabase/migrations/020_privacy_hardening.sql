-- 020: endurecimento de privacidade (achados da auditoria do banco: npm run check:db).
--
--  1. can_chat(a, b) e is_blocked(a, b) eram chamáveis por qualquer usuário logado com QUAISQUER dois ids:
--     dava para descobrir se duas pessoas deram match ou se uma bloqueou a outra. Agora só respondem
--     quando quem pergunta é uma das duas pessoas (todos os usos do app já são assim).
--  2. Fotos: a regra "avatars: ver" deixava listar TODAS as pastas do bucket (revelava o id de todos os
--     usuários). O bucket é público, então as fotos continuam abrindo pelo link normalmente; listar agora
--     só a própria pasta (e a do clube/comunidade que a pessoa administra, para trocar a foto).
--
-- Rodar depois da 019. Pode rodar de novo sem problema.

-- ─── 1. Match e bloqueio: só as partes envolvidas perguntam ────────────────────
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  -- Sem usuário (painel/servidor) responde normal; com usuário, só se ele for uma das partes
  select (auth.uid() is null or auth.uid() in (a, b))
    and exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public.can_chat(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
    and a <> b
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

revoke all on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;
revoke all on function public.can_chat(uuid, uuid) from public, anon;
grant execute on function public.can_chat(uuid, uuid) to authenticated;

-- ─── 3. LGPD: "Baixar meus dados" com tudo o que existe hoje ───────────────────
-- Acrescenta o que veio depois da 009: votos dados, vagas topadas, pedidos de entrada em clube
-- e o histórico de segurança da conta (troca e redefinição de senha).
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
    'avaliacoes_dadas', (select coalesce(jsonb_agg(jsonb_build_object('jogo', v.game_id, 'jogador', v.target, 'nota', v.score, 'em', v.updated_at)), '[]')
                         from public.game_votes v where v.voter = auth.uid()),
    'curtidas', (select coalesce(jsonb_agg(jsonb_build_object('para', s.to_user, 'bora', s.liked, 'em', s.created_at)), '[]')
                 from public.swipes s where s.from_user = auth.uid()),
    'mensagens', (select coalesce(jsonb_agg(jsonb_build_object('de', m.sender, 'para', m.recipient, 'texto', m.body, 'em', m.created_at)), '[]')
                  from public.messages m where auth.uid() in (m.sender, m.recipient)),
    'vagas', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.open_calls c where c.author = auth.uid()),
    'vagas_topadas', (select coalesce(jsonb_agg(jsonb_build_object('vaga', r.call_id, 'em', r.created_at)), '[]')
                      from public.call_responses r where r.user_id = auth.uid()),
    'pedidos_de_entrada', (select coalesce(jsonb_agg(jsonb_build_object('clube', g.name, 'situacao', j.status, 'em', j.created_at)), '[]')
                           from public.group_join_requests j join public.groups g on g.id = j.group_id where j.user_id = auth.uid()),
    'bloqueios', (select coalesce(jsonb_agg(jsonb_build_object('bloqueado', b.blocked, 'em', b.created_at)), '[]')
                  from public.blocks b where b.blocker = auth.uid()),
    'denuncias_feitas', (select coalesce(jsonb_agg(jsonb_build_object('motivo', r.reason, 'em', r.created_at)), '[]')
                         from public.reports r where r.reporter = auth.uid()),
    'seguranca_da_conta', jsonb_build_object(
      'senha_alterada_em', (select changed_at from public.password_changes where user_id = auth.uid()),
      'redefinicoes', (select coalesce(jsonb_agg(jsonb_build_object('data_conferida', ok, 'em', created_at) order by created_at desc), '[]')
                       from public.reset_attempts where user_id = auth.uid())
    )
  );
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ─── 2. Fotos: sem listar o bucket inteiro ─────────────────────────────────────
drop policy if exists "avatars: ver" on storage.objects;
drop policy if exists "avatars: listar só o que é meu" on storage.objects;
create policy "avatars: listar só o que é meu" on storage.objects for select
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'clubs' and public.group_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
      or ((storage.foldername(name))[1] = 'communities' and public.community_role(((storage.foldername(name))[2])::uuid) in ('owner', 'admin'))
    )
  );
