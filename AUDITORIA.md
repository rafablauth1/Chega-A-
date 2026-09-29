# Auditoria técnica do Vaia Aí (29/09/2026)

Revisão completa de segurança, dados, confiabilidade e qualidade de código, feita antes de abrir o app para mais
gente. **Rode `npm run check` antes de todo commit**: ele repete as verificações automáticas desta auditoria (o GitHub
também roda sozinho a cada envio e antes de publicar atualização).

## Como está (resumo)

| Área | Situação |
|---|---|
| Tabelas do banco com RLS (acesso controlado) | **23 de 23** |
| Funções privilegiadas com `search_path` travado | todas |
| Tipos (TypeScript) | sem erros |
| Regras de hooks do React (causa de travamentos) | sem violações |
| Segredos no repositório | nenhum (só a chave pública do Supabase, que é pública por natureza) |
| Atualizações automáticas | assinadas; o app recusa atualização adulterada (testado) |

## Problemas encontrados e corrigidos nesta revisão

| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | Média | `can_chat(a, b)`: qualquer usuário logado descobria se **duas pessoas quaisquer** deram match | Só responde se quem pergunta é uma das partes (migração 020) |
| 2 | Média | `is_blocked(a, b)`: qualquer um descobria **quem bloqueou quem** | Idem (020) |
| 3 | Média | Fotos: a regra "avatars: ver" deixava **listar o bucket inteiro** (revelava o id de todos os usuários) | Listagem só da própria pasta e das pastas de clube/comunidade que a pessoa administra; as fotos continuam abrindo pelo link (020) |
| 4 | Média (LGPD) | "Baixar meus dados" não trazia votos, vagas topadas, pedidos de entrada nem o histórico de segurança | Exportação completa (020) |
| 5 | Alta (uso real) | Sem internet por um instante, **a mudança era descartada** (gol, presença) | Até 4 novas tentativas com espera crescente (~27 s) antes de desistir; permissão negada não repete |
| 6 | Média | Erro inesperado numa tela derrubava o app | Tela de erro amigável com "Tentar de novo" (`ErrorBoundary` no layout raiz) |
| 7 | Média (desempenho) | A tela inicial baixava **o histórico inteiro de todos os clubes** a cada abertura | Busca só os próximos jogos (e só a presença deles) |
| 8 | Média | Robô de atualização publicaria código quebrado | Agora roda todas as verificações antes e para se algo falhar |
| 9 | Baixa | Chave colada no Secret do GitHub com quebras de linha perdidas | Leitura tolerante + mensagem clara |
| 10 | Baixa | Código morto (imports sem uso) e sem verificador de código | ESLint (config do Expo) no `npm run check` |

## Ferramentas novas

- `npm run check`: tipos + ESLint + sintaxe das migrações + **auditoria de segurança do banco** + segredos.
- `npm run check:db` (`scripts/audit-db.mjs`): lê todas as migrações e aponta tabela sem RLS, função privilegiada
  sem `search_path` e função que vaza dado de terceiros. Itens revisados à mão ficam registrados com o motivo.
- `.github/workflows/ci.yml`: roda tudo isso e monta o pacote Android a cada envio ao GitHub.

## Decisões para o dono (não mudei sem você)

1. **Dono de clube vira admin da comunidade** (migração 017). Qualquer membro de uma comunidade pode criar um clube,
   vincular e virar admin da comunidade. Numa comunidade de empresa isso pode não ser desejado.
   Sugestão: ao vincular, entrar como **membro**; admin só por promoção do dono da comunidade.
2. **Quem entra num jogo avulso pelo Bora e o clube é de uma comunidade** também entra na comunidade (gatilho da 017).
   Provavelmente ok, mas vale saber.

## Riscos conhecidos (próximos passos, por prioridade)

1. ~~Dois admins marcando gol ao mesmo tempo~~ **resolvido** (migração 021): um admin por jogo é o marcador do placar;
   o servidor ignora mudança de placar vinda de outro celular. O marcador passa a vez; o dono pode assumir.
2. **Sem monitoramento de erros em produção**: quando algo quebra no celular de alguém, ninguém fica sabendo.
   Recomendado: Sentry (grátis no começo), ligado no `ErrorBoundary`.
3. **E-mail próprio (SMTP)**: sem ele, usuários de verdade não recebem "esqueci a senha" nem confirmação.
4. **4 bibliotecas do Expo com atualização de correção** (`npx expo install --check`): atualizar **junto com o
   próximo APK** (mexem na parte nativa; atualizar só por OTA pode quebrar a compatibilidade).
5. **Testes automáticos** do cálculo de pontuação e das regras de senha (hoje testados à mão).
6. **Backup do banco**: plano grátis do Supabase não faz backup diário.
7. **Chave das atualizações no GitHub** (Secret): conveniente, mas quem invadir o GitHub publica atualização.
   Mantenha a verificação em duas etapas do GitHub ligada.
