# Tarefas do dono (o que só você pode fazer)

Coisas que precisam da **sua conta, do seu dinheiro ou da sua decisão**. O resto eu faço.
Marque `[x]` quando terminar e me avise. Ordem = prioridade.

---

## 🔴 Agora (para o que já está pronto funcionar)

### 1. Rodar as migrações no Supabase (004 a 009 feitas em 28/09 ✅; falta a 010)
Sem isso, excluir conta, comunidades, região e "Bora jogar?" dão erro no app.

1. Entre em https://supabase.com/dashboard e abra o projeto **ycgaprsgshtfveajjkby**.
2. Menu da esquerda: **SQL Editor** → **New query**.
3. Abra o arquivo no PC, copie **tudo**, cole e clique em **Run**. Deve aparecer *"Success. No rows returned"*.
4. Uma de cada vez, **nesta ordem**:
   - [x] `supabase/migrations/004_delete_account.sql`: excluir conta
   - [x] `supabase/migrations/005_communities.sql`: comunidades
   - [x] `supabase/migrations/006_region.sql`: bairro e posição aproximada
   - [x] `supabase/migrations/007_discovery.sql`: "Bora jogar?", match, "Falta gente!", bloquear e denunciar
   - [x] `supabase/migrations/008_chat.sql`: chat dentro do app
   - [x] `supabase/migrations/009_security.sql`: **segurança** (telefone e dados pessoais só para quem pode, limites anti-spam, baixar meus dados)
   - [x] `supabase/migrations/010_password_security.sql`: **senha** (data de nascimento na redefinição conferida pelo servidor, trava de troca de senha)
   - [ ] `supabase/migrations/011_match_votes.sql`: **avaliação da galera** estilo Cartola (encerrar jogo, 24 h para votar, voto secreto)
   - [ ] `supabase/migrations/012_court_time_and_roles.sql`: **horário da quadra** (início/fim, duração da partida) e **só o dono mexe em admin**
   - [ ] `supabase/migrations/013_clubs_and_single_games.sql`: **clubes e jogos avulsos** (jogo sem clube, publicar no Bora e entrar direto)
   - [x] `supabase/migrations/020_privacy_hardening.sql`: **privacidade** (auditoria: match/bloqueio de terceiros, listagem de fotos, exportação LGPD completa)
   - [ ] `supabase/migrations/021_scorekeeper.sql`: **marcador do placar** (um admin por jogo; passa a vez; dono assume)
5. Se alguma der erro, **pare** e me mande a mensagem de erro (print serve).

> Eu confiro a escrita de todos os arquivos com o verificador do próprio Postgres (`npm run check:sql`), mas só rodando no seu Supabase dá para ter certeza de que funcionam.

### 1.1 Ligar as atualizações automáticas (uma vez só, 5 min)
O app 1.1.0 em diante se atualiza sozinho pelo GitHub. Falta publicar a "ponte" no Supabase:
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome: `app-updates` (exatamente assim).
3. Apague o exemplo e cole o conteúdo de `supabase/functions/app-updates/index.ts`
   (https://raw.githubusercontent.com/rafablauth1/Chega-A-/main/supabase/functions/app-updates/index.ts) → **Deploy**.
4. Na função, em **Details/Settings**: **desligar "Enforce JWT Verification"** → Save.
5. Me avise: eu testo daqui.
- [x] Função publicada: ficou com o nome **rapid-endpoint** (é ela a ponte; não apagar nem renomear)
- [x] Na função rapid-endpoint → Settings → desligar "Verify JWT" → Save (feito e testado em 28/09)

### 1.2 Guardar as chaves do app (MUITO importante)
- [ ] Copie a pasta **C:\Users\10088132\VaiaAi-chave** inteira para o seu Google Drive pessoal ou um pendrive.
  Ela tem a chave que assina o APK e a que assina as atualizações. **Perdeu = nunca mais atualiza o app.**
  Leia o `LEIA-ME.txt` que está dentro.

### 2. Instalar o APK novo e testar
O APK que você tem é antigo: não tem visual novo, localização, comunidades nem "Bora".
- [ ] Me peça **"gera o APK"**. Eu compilo aqui no PC (demora uns 15 min) e deixo em `Desktop\Vaia Aí\`.
- [ ] Passe pro celular pelo cabo (pasta Download) e instale por cima do antigo.
- [ ] Roteiro de teste (anote o que der errado):
  - [ ] Criar conta, entrar e sair
  - [ ] Editar perfil: foto, data de nascimento, **Usar minha localização**, horários, WhatsApp
  - [ ] Criar grupo, marcar jogo, confirmar presença, sortear times
  - [ ] Criar **comunidade**, criar um time nela, entrar com outro celular pelo código
  - [ ] **Bora**: com 2 contas perto (pode ser você + um amigo), dar "bora" nos dois → tem que dar **match**
  - [ ] **Chat**: mandar mensagem depois do match; a outra conta recebe na hora e aparece "Visto"
  - [ ] **Falta gente**: publicar vaga numa conta e topar pela outra
  - [ ] **Excluir conta** (com uma conta de teste!)

### 3. Preencher seus dados na política de privacidade
- [ ] Me mande **nome completo (ou da empresa)** e **um e-mail de contato** (pode ser um e-mail só para o app, ex.: contato.vaiaai@gmail.com). Eu preencho e publico.
- [ ] Depois, se puder, peça para **um advogado dar uma lida** na política e nos termos (`docs/privacidade.html` e `docs/termos.html`).

### 4. Ligar o site das páginas legais (GitHub Pages), 2 minutos
O Google Play exige um link público para a política de privacidade e para a exclusão de conta.
1. Abra https://github.com/rafablauth1/Chega-A- → **Settings** → **Pages** (menu da esquerda).
2. Em *Build and deployment*: **Source = Deploy from a branch**, **Branch = main**, pasta **/docs** → **Save**.
3. Espere uns minutos. Os links ficam:
   - [ ] https://rafablauth1.github.io/Chega-A-/privacidade.html
   - [ ] https://rafablauth1.github.io/Chega-A-/excluir-conta.html
   - [ ] https://rafablauth1.github.io/Chega-A-/termos.html

> O repositório é **público** (conferido), então o Pages grátis funciona. Lembre que isso deixa o código visível para qualquer um; as senhas e dados dos usuários ficam no Supabase, não no código.

---

## 🔴 Segurança das suas contas (faça uma vez, leva 20 min)
Detalhes e o porquê em `SEGURANCA.md`. **Quem invadir uma dessas contas controla o app inteiro.**
- [ ] **Verificação em duas etapas (2FA)** no **GitHub**, **Supabase**, **Google** (a da Play Store) e **Expo**.
- [ ] Supabase → **Authentication → Providers → Email** (ou *Sign In / Providers → Email*):
  - **Minimum password length: 8**
  - **Password requirements: Lowercase, uppercase letters, digits and symbols** (a opção mais forte)
  - **Secure password change: ligado** e **Secure email change: ligado**
  - **Email OTP Expiration: 900** (15 minutos) e **Email OTP Length: 6**
- [ ] Supabase → **Authentication → URL Configuration → Redirect URLs** → **Add URL**: `vaiaai://**` → Save.
  - **Sem isso, o link do e-mail de "esqueci a senha" não abre o app.**
- [ ] (Depois, quando tiver e-mail próprio/SMTP; no servidor padrão o Supabase não deixa editar)
  **Authentication → Emails → Reset Password**: assunto `Seu código do Vaia Aí: {{ .Token }}` e corpo
  `supabase/templates/recovery.html`. Aí o e-mail passa a ter também um código de 6 números (o link continua valendo).
- [ ] Supabase → **Authentication → Attack Protection**: ligar **CAPTCHA** com Cloudflare Turnstile (grátis) e me avisar, que eu ligo no app.
- [ ] Supabase → **Advisors → Security Advisor**: rodar depois das migrações e me mandar um print do que aparecer.
- [ ] Nunca mande para ninguém (nem para mim no chat) a chave **service_role / secret** do Supabase. A que eu uso é a *publishable*, que é pública.

---

## 🟡 Toda semana

### 5. Olhar as denúncias
- [ ] Supabase → **Table Editor** → tabela **reports**. Cada linha é uma denúncia (quem denunciou, quem foi denunciado e o motivo).
- Quem foi denunciado já some para quem denunciou (é bloqueado na hora).
- Casos graves: me avise que eu crio o botão de **suspender conta**. Por enquanto, o jeito é apagar o usuário em **Authentication → Users**.
- Depois de analisar, mude a coluna `status` para `analisada`.

---

## 🟢 Para publicar na Play Store

### 6. Decisões
- [ ] **Nome definitivo**: "Vaia Aí" ou "Chega Aí"? (ícone, loja e textos mudam juntos)
- [ ] **Domínio** (opcional, ~R$ 40/ano em registro.br): ex. `vaiaai.com.br`. Serve para e-mail próprio e links bonitos.

### 7. Conta Expo (para gerar o app pela nuvem, sem depender do seu PC)
1. [ ] Crie conta grátis em https://expo.dev/signup
2. [ ] Em **Account settings → Access tokens**, crie um token e me mande (ou deixe salvo no PC).

### 8. Conta Google Play Console (US$ 25, uma vez)
1. [ ] https://play.google.com/console/signup, com uma conta Google sua (de preferência uma só para o app).
2. [ ] Pague a taxa e faça a **verificação de identidade** (documento com foto; se for empresa, pede CNPJ/D-U-N-S).
3. [ ] Contas pessoais novas precisam fazer um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de publicar (regra do Google; confira no Console, ela muda às vezes). Vá juntando 12 amigos com Android e e-mail Gmail.
4. [ ] Quando tiver a conta, me avise: eu preparo textos da loja, prints, formulário de segurança de dados e o build assinado.

### 9. Apple / iPhone (opcional, US$ 99 por ano)
- [ ] Só se quiser o app no iPhone: conta em https://developer.apple.com/programs/. **Não precisa de Mac**: eu gero o app do iPhone pela nuvem (EAS).

### 10. E-mail próprio (SMTP) ✅ (feito em 28/09)
O e-mail padrão do Supabase é só para teste: **só entrega para os e-mails da sua equipe no Supabase**, manda poucos
por hora e não deixa mudar o texto. Sem SMTP próprio, **nenhum usuário recebe o e-mail de "esqueci a senha"**
nem o de confirmação de cadastro.
- [ ] Criar um Gmail só do app (ex.: vaiaai.app@gmail.com).
- [ ] Criar conta grátis no https://www.brevo.com com esse Gmail (300 e-mails por dia).
- [ ] Me avisar: eu passo os 5 campos para colar em Supabase → Authentication → SMTP Settings.
- [ ] Depois: colar o modelo `supabase/templates/recovery.html` em Authentication → Emails → Reset Password (código de 6 números).
- Alternativa quando tiver domínio (ex.: vaiaai.com.br): https://resend.com (3 mil por mês, e-mail @vaiaai.com.br).

---

## Onde ficam as coisas
| O quê | Onde |
|---|---|
| Código do app | https://github.com/rafablauth1/Chega-A- |
| Banco de dados, usuários e denúncias | https://supabase.com/dashboard (projeto ycgaprsgshtfveajjkby) |
| Roteiro do que falta fazer | `ROADMAP.md` |
| APK gerado no PC | `Desktop\Vaia Aí\` |
