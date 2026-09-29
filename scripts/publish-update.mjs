/**
 * Publica uma ATUALIZAÇÃO AUTOMÁTICA (sem APK novo) para quem já tem o app instalado.
 *
 *   npm run update:publish            (depois: git add updates && git commit && git push)
 *
 * O que faz:
 *  1. Gera o pacote do app (expo export) para Android.
 *  2. Copia o código e as imagens para updates/files/ (nome = hash do conteúdo, então nada se repete).
 *  3. Escreve updates/android/<versão>/manifest.json dizendo qual é a atualização mais nova.
 *  4. ASSINA o manifesto com a chave privada que fica só neste PC (fora do repositório).
 *     O app confere a assinatura com o certificado em certs/certificate.pem e recusa qualquer coisa não assinada.
 *
 * Só serve para mudanças de JavaScript/telas/regras. Mudou biblioteca nativa, permissão, ícone ou app.json de
 * forma que afete o Android? Aí é APK novo (subir "version" em app.json, o que também separa as atualizações).
 */
import { execSync } from 'node:child_process';
import { createHash, createPrivateKey, randomUUID, sign, verify, X509Certificate } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';

const RAW = 'https://raw.githubusercontent.com/rafablauth1/Chega-A-/main/updates/files';
const KEY_PATH = process.env.VAIAAI_UPDATES_KEY ?? 'C:/Users/10088132/VaiaAi-chave/updates-keys/private-key.pem';
const CERT_PATH = 'certs/certificate.pem';
const PLATFORM = 'android';

const env = { ...process.env, npm_config_proxy: 'null', npm_config_https_proxy: 'null', NODE_NO_WARNINGS: '1' };
const run = (cmd) => execSync(cmd, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });

if (!existsSync(KEY_PATH)) {
  console.error(`Chave de assinatura das atualizações não encontrada em ${KEY_PATH}. Sem ela não dá para publicar.`);
  process.exit(1);
}

/**
 * Lê a chave aceitando os jeitos comuns de ela chegar estragada ao ser colada (ex.: no Secret do GitHub):
 * quebras de linha perdidas ou viradas em espaço, "\n" literal, \r do Windows, espaços nas pontas, aspas,
 * ou a chave inteira em base64. Confere já no começo, antes de gastar tempo gerando o pacote.
 */
function loadPrivateKey(path) {
  let raw = readFileSync(path, 'utf8').replace(/^﻿/, '').trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\r/g, '');
  if (!raw.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) raw = decoded.trim();
    } catch {}
  }
  const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(raw);
  if (!m) throw new Error('A chave não tem as linhas "-----BEGIN ... KEY-----" e "-----END ... KEY-----". Copie o arquivo inteiro.');
  const body = m[2].replace(/\s+/g, '');
  const pem = `-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END ${m[1]}-----\n`;
  try {
    return createPrivateKey(pem);
  } catch {
    throw new Error('A chave foi encontrada mas está incompleta ou é outra chave. Copie de novo o private-key.pem inteiro.');
  }
}
const privateKey = loadPrivateKey(KEY_PATH);
{
  const probe = Buffer.from('teste');
  const cert = new X509Certificate(readFileSync(CERT_PATH, 'utf8'));
  if (!verify('sha256', probe, cert.publicKey, sign('sha256', probe, privateKey)))
    throw new Error('Essa chave não é a par do certificado do app (certs/certificate.pem). Use o private-key.pem da pasta VaiaAi-chave/updates-keys.');
}

const appJson = JSON.parse(readFileSync('app.json', 'utf8')).expo;
if (appJson.runtimeVersion?.policy !== 'appVersion') throw new Error('Esperava runtimeVersion.policy = appVersion em app.json');
const runtime = appJson.version;

// 1. Pacote
const out = join(tmpdir(), `vaiaai-update-${Date.now()}`);
console.log(`Gerando o pacote da versão ${runtime}...`);
run(`npx expo export --platform ${PLATFORM} --output-dir "${out}"`);
const metadata = JSON.parse(readFileSync(join(out, 'metadata.json'), 'utf8')).fileMetadata[PLATFORM];

const CONTENT_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json', '.hbc': 'application/javascript',
  '.js': 'application/javascript',
};

// 2. Arquivos (endereçados pelo conteúdo)
mkdirSync('updates/files', { recursive: true });
const asset = (relPath, ext, isLaunch = false) => {
  const data = readFileSync(join(out, relPath));
  const hash = createHash('sha256').update(data).digest('base64url');
  const key = createHash('md5').update(data).digest('hex');
  const fileExtension = ext.startsWith('.') ? ext : `.${ext}`;
  const name = `${key}${isLaunch ? '.bundle' : fileExtension}`;
  const dest = join('updates/files', name);
  if (!existsSync(dest)) copyFileSync(join(out, relPath), dest);
  return {
    hash,
    key,
    contentType: isLaunch ? 'application/javascript' : CONTENT_TYPES[fileExtension] ?? 'application/octet-stream',
    ...(isLaunch ? {} : { fileExtension }),
    url: `${RAW}/${name}`,
  };
};

const launchAsset = asset(metadata.bundle, extname(metadata.bundle) || '.hbc', true);
const assets = metadata.assets.map((a) => asset(a.path, a.ext));

// 3. Manifesto
const expoClient = JSON.parse(run('npx expo config --type public --json'));
const manifest = {
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  runtimeVersion: runtime,
  launchAsset,
  assets,
  metadata: {},
  extra: { expoClient },
};
const body = JSON.stringify(manifest);

// 4. Assinatura (RSA-SHA256, o que o app espera: codeSigningMetadata alg rsa-v1_5-sha256, keyid main)
const sig = sign('sha256', Buffer.from(body, 'utf8'), privateKey).toString('base64');
const cert = new X509Certificate(readFileSync(CERT_PATH, 'utf8'));
if (!verify('sha256', Buffer.from(body, 'utf8'), cert.publicKey, Buffer.from(sig, 'base64')))
  throw new Error('A assinatura não confere com certs/certificate.pem: chave e certificado são de pares diferentes.');

const dir = join('updates', PLATFORM, runtime);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'manifest.json'), body);
writeFileSync(join(dir, 'manifest.sig'), `sig="${sig}", keyid="main"`);
rmSync(out, { recursive: true, force: true });

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(`\nok  atualização ${manifest.id}`);
console.log(`    versão do app: ${runtime} · código ${kb(join('updates/files', launchAsset.url.split('/').pop()))} KB + ${assets.length} arquivos`);
console.log('    assinatura conferida com certs/certificate.pem');
console.log('    Agora: git add updates && git commit -m "Atualização" && git push');
console.log('    Os celulares recebem na próxima vez que abrirem o app (o GitHub pode levar até 5 min para mostrar).');
