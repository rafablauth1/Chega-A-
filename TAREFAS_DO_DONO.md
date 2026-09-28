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
   - [ ] `supabase/migrations/010_password_security.sql`: **senha** (data de nascimento na redefinição conferida pelo servidor, trava de troca de senha)
5. Se alguma der erro, **pare** e me mande a mensagem de erro (print serve).

> Eu confiro a escrita de todos os arquivos com o verificador do próprio Postgres (`npm run check:sql`), mas só rodando no seu Supabase dá para ter certeza de que funcionam.

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
- [ ] Supabase → **Authentication → Emails → Reset Password** (e-mail de "esqueci a senha"):
  - Assunto: `Seu código do Vaia Aí: {{ .Token }}`
  - Corpo: apague o que tem e cole o conteúdo de `supabase/templates/recovery.html`.
  - **Sem isso, o e-mail chega com um link em vez do código e a redefinição não funciona no app.**
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

### 10. E-mail do login (quando tiver o domínio)
- [ ] Conta grátis no https://resend.com (3 mil e-mails por mês) para os e-mails de confirmação e de "esqueci a senha". Eu configuro no Supabase com você.

---

## Onde ficam as coisas
| O quê | Onde |
|---|---|
| Código do app | https://github.com/rafablauth1/Chega-A- |
| Banco de dados, usuários e denúncias | https://supabase.com/dashboard (projeto ycgaprsgshtfveajjkby) |
| Roteiro do que falta fazer | `ROADMAP.md` |
| APK gerado no PC | `Desktop\Vaia Aí\` |
