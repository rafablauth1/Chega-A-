# Roteiro do app (Vaia Aí / Chega Aí)

Marque `[x]` no que você **autoriza**. Pode riscar, reordenar ou comentar do lado de cada item.
Itens marcados com ⚠️ exigem uma **decisão sua** (custo, conta externa ou escolha de produto).

Legenda de tamanho: 🟢 pequeno (horas) · 🟡 médio (1–2 dias) · 🔴 grande (vários dias)

---

## ✅ Fase 0: Já feito

- [x] App Android + iOS (Expo / React Native, TypeScript), rodando também no navegador para testes
- [x] Cadastro de jogadores: nome, apelido, WhatsApp, posição, mensalista/avulso, ativo/inativo
- [x] Avaliação por estrelas em 5 habilidades (técnica, físico, passe, finalização, defesa)
- [x] Nota pós-jogo por jogador; nota geral = 60% habilidades + 40% partidas
- [x] Jogos: data, local, valor, jogadores por time, limite de vagas, observações
- [x] Lista de presença com **lista de espera automática** (sobe sozinho quando alguém sai)
- [x] Botão "confirmar todos os mensalistas" e envio da lista pelo WhatsApp
- [x] **Sorteio equilibrado** (nota + posições + um goleiro por time)
- [x] **Escalar na mão**: banco de reservas, colocar/trocar jogadores entre times, adicionar/remover time
- [x] **Campinho visual estilo Cartola** (com alternância para lista)
- [x] **Placar ao vivo** com cronômetro, vibração no fim, gol, assistência e gol contra
- [x] Sugestão de confronto "quem ganha fica", classificação e artilharia do dia
- [x] Craque do jogo (troféu)
- [x] Financeiro: mensalidades por mês, avulsos devendo, despesas, saldo do caixa, cobrança via WhatsApp
- [x] Ajustes do grupo, dados de exemplo (20 jogadores), backup exportar/importar, apagar tudo

---

## Fase 1: Polimento do que já existe (sem custo, sem conta externa)

- [x] 🟡 **Aba Ranking**: artilharia, assistências, presença (%), nota média, craques, vitórias; filtro por mês/ano/geral
- [x] 🟢 **Perfil do jogador com estatísticas**: jogos, gols, assistências, V/E/D, craques, últimas notas
- [x] 🟡 **Card do jogador estilo FIFA** (overall + atributos) para compartilhar
- [x] 🟡 **Compartilhar imagem do campinho** no WhatsApp (print dos times, não só texto)
- [ ] 🟢 Seletor de data/hora nativo (calendário), no lugar de digitar
- [x] 🟢 Jogo recorrente: botão "Marcar próximo jogo" repete o último na semana seguinte
- [ ] 🟢 Vibração/feedback tátil nos toques importantes
- [ ] 🟢 Ícone, splash e nome definitivos do app ⚠️ *(qual nome: "Vaia Aí" ou "Chega Aí"?)*
- [ ] 🟢 Tema claro opcional
- [ ] 🟡 Histórico de mensalidade guardando o valor pago em cada mês (hoje usa o valor atual)
- [ ] 🟢 Cartões amarelo/vermelho e "pipoqueiro" (faltou sem avisar)
- [ ] 🟡 Testes automatizados do sorteio e do financeiro

## Fase 2: Contas e nuvem (vira app de verdade para o grupo todo)

- [ ] 🔴 Backend na nuvem ⚠️ *(recomendo **Supabase**: grátis no início, Postgres, login pronto. Alternativa: Firebase)*
- [ ] 🔴 Login: celular (SMS), Google e Apple ⚠️ *(SMS tem custo por mensagem; Google/Apple são grátis)*
- [ ] 🔴 Grupos com vários usuários e papéis: **dono, admin, jogador**
- [ ] 🟡 Convite por link/QR code para entrar no grupo
- [ ] 🟡 Sincronização entre celulares + funcionamento offline
- [ ] 🟢 Migrar os dados locais atuais para a conta na nuvem
- [ ] 🟡 Participar de **vários grupos** (pelada de quinta, futevôlei de sábado...)

## Fase 3: O jogador participa pelo próprio celular

- [ ] 🟡 Cada um **confirma presença** sozinho ("Vou" / "Não vou" / "Talvez")
- [ ] 🟡 **Avaliação entre amigos** anônima após o jogo (média de todos vira a nota)
- [ ] 🟢 **Votação do craque do jogo** e bola murcha (o pior)
- [ ] 🔴 **Notificações push**: lista aberta, lembrete no dia, vaga liberada na espera, cobrança ⚠️ *(Apple exige conta de desenvolvedor)*
- [ ] 🟡 Prazo para confirmar; depois dele, abre para avulsos/lista de espera
- [ ] 🟡 Mural/avisos do grupo e comentários no jogo
- [ ] 🟢 Regras do grupo (texto fixo)

## Fase 4: Financeiro avançado

- [x] 🟢 **Pix copia-e-cola / QR Code** com a chave do organizador (estático, sem taxa)
- [ ] 🟡 Jogador envia **comprovante** (foto) e o admin aprova
- [ ] 🔴 Pagamento automático (Pix dinâmico/cartão via Mercado Pago ou Asaas) ⚠️ *(taxa por transação, precisa de CNPJ/CPF cadastrado)*
- [ ] 🟡 Relatório mensal em PDF (entradas, saídas, quem deve)
- [ ] 🟢 Multa por falta sem aviso / taxa de goleiro de aluguel
- [ ] 🟢 Rateio de despesa extra entre os presentes (ex.: churrasco)

## Fase 5: Estatísticas e gamificação

- [ ] 🟡 **Temporadas** (ranking zera a cada semestre/ano, com campeão)
- [x] 🟡 **Conquistas/badges** (hat-trick, 10 jogos seguidos, garçom, muralha...)
- [x] 🟡 Seleção da rodada no campinho (melhores de cada posição)
- [ ] 🟡 Gráfico da evolução da nota do jogador
- [ ] 🟢 Duplas que mais ganham juntas / confronto direto
- [x] 🟡 Súmula do dia para compartilhar (placares, artilheiro, craque)

## Fase 6: Extras

- [ ] 🟡 Check-in no local (GPS) para marcar presença/atraso
- [ ] 🟢 Controle de colete/bola (quem leva, quem lava)
- [ ] 🟡 Encontrar jogadores avulsos/goleiros para completar o time
- [ ] 🔴 Reserva de quadra integrada ⚠️ *(depende de parceria com as arenas)*

## Fase 7: Publicação nas lojas

- [ ] 🟢 Build de teste instalável (APK para Android) via EAS
- [ ] 🟡 Conta **Google Play** ⚠️ *(US$ 25, pagamento único)*
- [ ] 🟡 Conta **Apple Developer** ⚠️ *(US$ 99/ano; necessária para iPhone fora do Expo Go)*
- [ ] 🟡 Política de privacidade e termos (LGPD)
- [ ] 🟡 Teste fechado com a galera (Play interno / TestFlight)
- [ ] 🟡 Publicação oficial nas lojas

---

### Decisões que só você pode tomar
1. **Nome do app**: "Vaia Aí" ou "Chega Aí"?
2. **Backend** (Fase 2): Supabase (recomendado) ou Firebase?
3. **Login**: vale pagar SMS ou começamos só com Google/Apple?
4. **Lojas**: quando criar as contas Google Play / Apple?
5. **Pagamentos**: Pix estático (grátis) basta, ou quer cobrança automática com taxa?
