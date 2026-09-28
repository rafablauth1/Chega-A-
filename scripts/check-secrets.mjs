/**
 * Procura segredos que NUNCA podem ir para o repositório (que é público) nem para o app:
 * chave service_role / secret do Supabase, chaves de pagamento, tokens.
 * Rodar: npm run check:secrets   (roda também antes de cada commit, pelo hook em .githooks)
 *
 * A chave "publishable" do Supabase (sb_publishable_...) é pública por natureza e é permitida.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'chave secreta do Supabase (sb_secret_)'],
  [/service_role["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i, 'chave service_role do Supabase com valor'],
  [/eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'token JWT (pode ser chave antiga do Supabase)'],
  [/APP_USR-[0-9a-f-]{20,}|TEST-[0-9]{10,}-[0-9]{6}-[0-9a-f]{32}/, 'token do Mercado Pago'],
  [/\$aact_[A-Za-z0-9]{20,}/, 'chave do Asaas'],
  [/sk_(live|test)_[A-Za-z0-9]{16,}/, 'chave secreta do Stripe'],
  [/-----BEGIN (RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'chave privada'],
  [/EXPO_TOKEN\s*=\s*\S{10,}/, 'token do Expo'],
  [/VAIAAI_UPLOAD_(STORE|KEY)_PASSWORD\s*=\s*[A-Za-z0-9!@#$%^&*_+-]{8,}/, 'senha da chave de assinatura do app'],
];

// Arquivos versionados + os que estão para entrar no commit
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('node_modules/') && !/\.(png|jpg|jpeg|ttf|otf|apk|aab|ico)$/i.test(f))
  .filter((f) => f !== 'scripts/check-secrets.mjs' && f !== 'SEGURANCA.md')
  // Pacotes compilados das atualizações automáticas: são gerados a partir do código-fonte (que já é verificado)
  // e têm os textos grudados, o que dá falso alarme (ex.: o "sb_secret_" que o supabase-js usa para RECUSAR chave secreta)
  .filter((f) => !/^updates\/files\/.+\.bundle$/.test(f));

let found = 0;
// Arquivos de chave de assinatura nunca podem entrar no repositório
for (const f of files) {
  // certs/certificate.pem é o certificado PÚBLICO das atualizações (pode e deve ir para o repositório)
  if (/\.(keystore|jks|p12|pem|key)$/i.test(f) && !/debug\.keystore$/.test(f) && f !== 'certs/certificate.pem') {
    found++;
    console.log(`PERIGO  ${f}  arquivo de chave (assinatura do app ou certificado)`);
  }
}
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of PATTERNS) {
      if (re.test(line)) {
        found++;
        console.log(`PERIGO  ${f}:${i + 1}  ${what}`);
      }
    }
  });
}

if (found) {
  console.log(`\n${found} possível(is) segredo(s). Tire do arquivo, e se já foi para o GitHub, troque a chave no painel.`);
  process.exit(1);
}
console.log(`ok  nenhum segredo encontrado em ${files.length} arquivos`);
