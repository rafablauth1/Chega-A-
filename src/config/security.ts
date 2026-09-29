/**
 * ⚙️  REGRAS DE SEGURANÇA DO APP: mude aqui e tudo o que depende delas acompanha
 * (telas de cadastro, troca e redefinição de senha, mensagens e a barrinha de força).
 *
 * Importante: o app é a primeira barreira; a de verdade fica no servidor.
 *  - Regras de senha: configure IGUAL no Supabase → Authentication → Providers → Email
 *    (Minimum password length + Password requirements). Se só mudar aqui, quem chamar a API direto escapa.
 *  - Data de nascimento na redefinição: quem manda é a tabela `security_settings` no Supabase
 *    (Table Editor → security_settings → reset_requires_birthdate). O app lê de lá.
 * Veja SEGURANCA.md, seção 3.
 */
export const SECURITY = {
  password: {
    minLength: 8,
    /** bcrypt ignora o que passa de 72 bytes; não aumente */
    maxLength: 72,
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    requireSymbol: true,
    /** Recusa senhas que já vazaram em outros sites (base Have I Been Pwned; só 5 letras do hash saem do celular) */
    blockLeaked: false,
    /** Recusa senha que contém o nome ou o e-mail da pessoa */
    blockPersonalInfo: true,
  },

  signup: {
    /** Data de nascimento obrigatória no cadastro (usada também para redefinir a senha) */
    requireBirthDate: true,
    /** Idade mínima para criar conta (os Termos dizem 13) */
    minAge: 13,
  },

  reset: {
    /** Pedir a data de nascimento na tela "Esqueci minha senha" (o servidor confere; ver security_settings) */
    askBirthDate: true,
    /** Tamanho do código que chega por e-mail (Supabase → Auth → Email OTP Length) */
    codeLength: 6,
  },

  login: {
    /** Depois de tantas senhas erradas seguidas neste celular, espera um tempo antes de tentar de novo */
    maxAttempts: 5,
    /** Espera em segundos; dobra a cada nova rodada de erros */
    lockSeconds: 30,
  },

  session: {
    /** Ao trocar ou redefinir a senha, desconecta todos os outros aparelhos */
    signOutOthersOnPasswordChange: true,
  },
} as const;
