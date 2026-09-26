# Roteiro do app (Vaia Aí / Chega Aí)

Marque `[x]` no que você **autoriza**. Pode riscar, reordenar ou comentar do lado de cada item.
Itens marcados com ⚠️ exigem uma **decisão sua** (custo, conta externa ou escolha de produto).

Legenda de tamanho: 🟢 pequeno (horas) · 🟡 médio (1–2 dias) · 🔴 grande (vários dias)

A ordem das fases é a sugestão para chegar no nível dos apps de pelada que estão na Play Store:
primeiro o que é **obrigatório para publicar**, depois o que **faz a galera abrir o app toda semana**,
depois o que **facilita a vida do organizador**, e por fim o que **diferencia e dá dinheiro**.

---

## ✅ Já feito

**Pelada no celular**
- [x] Cadastro de jogadores com posição, mensalista/avulso e avaliação por habilidades
- [x] Jogos com lista de presença e **lista de espera automática**
- [x] **Sorteio equilibrado** (nota + posição + goleiro) e **escalação na mão** no campinho estilo Cartola
- [x] **Placar ao vivo** com cronômetro, gols, assistências, gol contra; "quem ganha fica"
- [x] Nota pós-jogo **de 1 a 10**, craque do jogo, seleção da rodada, súmula
- [x] Ranking (artilharia, assistências, presença, nota, craque, vitórias) por mês/ano/geral
- [x] Card estilo FIFA, conquistas, compartilhar imagem dos times
- [x] Financeiro: mensalidades, avulsos, despesas, saldo, **Pix copia-e-cola / QR**

**Contas e nuvem**
- [x] Login por e-mail e senha (Supabase)
- [x] **Perfil de atleta** com carreira somando todos os grupos (jogos, gols, nota média, conquistas)
- [x] **Grupos** com papéis dono / admin / jogador e **convite por código**
- [x] Vários grupos por pessoa
- [x] Tudo sincronizado **em tempo real** entre os celulares
- [x] Jogador **confirma a própria presença** ("Vou!" / "Não vou mais")
- [x] Convidados sem conta + **vincular convidado à conta** quando ele entra no app
- [x] Enviar para a nuvem os dados que estavam só no celular

---

## Fase 1: Obrigatório para publicar na Play Store

Sem isso a loja recusa o app ou a experiência fica abaixo do mínimo esperado.

- [ ] 🟢 **Excluir minha conta** dentro do app e por uma página web *(exigência do Google Play para apps com login)*
- [ ] 🟡 **Política de privacidade e termos de uso** (LGPD), com link no app e na loja
- [ ] 🟢 Trocar senha / "esqueci minha senha" com tela própria de nova senha
- [ ] 🟡 **E-mail próprio para o login** (confirmação e recuperação de senha) ⚠️ *(o e-mail grátis do Supabase manda ~2 por hora; Resend tem plano grátis de 3 mil/mês, precisa de um domínio)*
- [ ] 🟢 Religar a **confirmação de e-mail** depois do item acima
- [ ] 🟢 **Nome, ícone e splash definitivos** ⚠️ *(qual nome: "Vaia Aí" ou "Chega Aí"?)*
- [ ] 🟡 Conta **Google Play** e build pela nuvem (EAS) assinado para a loja ⚠️ *(US$ 25, pagamento único)*
- [ ] 🟡 **Atualização sem reinstalar** (EAS Update): corrigir e melhorar o app sem mandar APK novo para todo mundo
- [ ] 🟡 **Monitor de erros** (Sentry, grátis no início): saber quando o app trava no celular de alguém
- [ ] 🟡 Teste fechado com a galera pela Play Store (trilha de teste interno)

## Fase 2: O que faz a galera abrir o app toda semana

É o que os apps populares da categoria têm em comum: lembrar, engajar e gerar resenha.

- [ ] 🔴 **Notificações push**: lista aberta, lembrete no dia, vaga liberada na espera, cobrança, times sorteados
- [ ] 🟡 **Foto de perfil** (câmera ou galeria) no card, na lista e no campinho
- [ ] 🟡 **Convite por link**: o link abre o app direto no grupo (e manda para a loja se não tiver o app) + QR code
- [ ] 🟡 **Avaliação entre amigos** após o jogo: cada um dá nota aos outros, a média vira a nota (anônimo)
- [ ] 🟢 **Votação do craque e da bola murcha** pelos jogadores
- [ ] 🟢 **Placar ao vivo para quem não foi**: acompanhar o jogo pelo celular em tempo real (a base já existe)
- [ ] 🟡 **Mural do grupo**: avisos, comentários no jogo, reações
- [ ] 🟡 **Temporadas** com campeão (ranking zera a cada semestre/ano, com troféu no perfil)
- [ ] 🟡 Gráfico de **evolução da nota** e da artilharia no perfil
- [ ] 🟢 **Card para story do Instagram** (formato vertical) com a atuação do dia
- [ ] 🟢 Duplas que mais ganham juntas / confronto direto / "freguês"
- [ ] 🟢 Mais conquistas (sequência de jogos, sequência de vitórias, 100 gols, fiel da pelada...)

## Fase 3: Vida do organizador mais fácil

- [ ] 🟡 **Jogo recorrente automático**: "toda quinta 20h" cria o jogo e abre a lista sozinho
- [ ] 🟡 **Prazo para confirmar** e **prioridade para mensalistas**: depois do prazo abre para avulsos/espera
- [ ] 🟢 Seletor de data e hora nativo (calendário)
- [ ] 🟡 **Regras de sorteio**: separar quem sempre joga junto, fixar goleiros, times por colete/cor
- [ ] 🟢 **Modalidades**: futsal, society, campo (jogadores por time, tempo e formação no campinho)
- [ ] 🟢 Cartões amarelo/vermelho, falta sem avisar ("pipoqueiro"), atraso
- [ ] 🟡 Jogador envia **comprovante do Pix** (foto) e o admin aprova
- [ ] 🟢 **Cobrança automática** pelo WhatsApp/push de quem está devendo
- [ ] 🟡 Histórico de mensalidade com o valor de cada mês + **rateio de despesa** extra (churrasco, quadra)
- [ ] 🟡 **Relatório do mês em PDF** para mandar no grupo
- [ ] 🟢 Rodízio de tarefas: quem leva a bola, quem lava o colete
- [ ] 🟡 **Funcionar sem internet** de verdade (fila de mudanças guardada até voltar a conexão)

## Fase 4: Diferencial e dinheiro

- [ ] 🔴 Login com **Google** e **Apple** ⚠️ *(Apple exige conta de desenvolvedor, US$ 99/ano)*
- [ ] 🔴 **Versão iPhone** na App Store / TestFlight ⚠️ *(mesma conta Apple acima)*
- [ ] 🔴 **Pagamento dentro do app** (Pix dinâmico/cartão com baixa automática, via Mercado Pago ou Asaas) ⚠️ *(taxa por transação, precisa de CPF/CNPJ cadastrado)*
- [ ] 🔴 **Achar jogador/goleiro avulso** na região para completar o time (perfil de atleta público)
- [ ] 🔴 **Grupos abertos**: achar pelada perto de você e pedir para entrar
- [ ] 🔴 Mapa de quadras e **reserva de horário** ⚠️ *(depende de parceria com as arenas)*
- [ ] 🟡 **Plano premium do organizador** ⚠️ *(ex.: financeiro completo, relatórios, vários grupos; decidir preço e o que fica grátis)*
- [ ] 🟢 Check-in por GPS no local (presença e atraso)

## Técnico (vai junto com as fases, sem aparecer para o usuário)

- [ ] 🟡 Transformar os testes que fiz contra o Supabase em **testes automáticos** do projeto (rodam a cada mudança)
- [ ] 🟢 Lint configurado e rodando antes de cada commit
- [ ] 🟢 Backup automático do banco (plano pago do Supabase) ou exportação periódica ⚠️
- [ ] 🟢 Tema claro opcional

---

### Decisões que só você pode tomar
1. **Nome do app**: "Vaia Aí" ou "Chega Aí"?
2. **Domínio** (ex.: vaiaai.com.br): necessário para e-mail próprio, link de convite e página de privacidade. Custa ~R$ 40/ano.
3. **Google Play**: quando criar a conta (US$ 25)?
4. **Apple**: vale pagar US$ 99/ano para ter iPhone e login Apple, ou começamos só com Android?
5. **Pagamentos**: Pix estático (grátis) basta, ou quer cobrança automática com taxa?
6. **Modelo de negócio**: grátis com premium para o organizador, anúncio, ou taxa nos pagamentos?

### Minha sugestão para os próximos 5
1. Excluir conta + política de privacidade (libera a publicação)
2. Foto de perfil (muda muito a cara do app)
3. Convite por link
4. Notificações push (o que mais traz a galera de volta)
5. Jogo recorrente automático + prazo de confirmação
