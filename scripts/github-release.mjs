// Sobe um APK no GitHub Releases.
//   node scripts/github-release.mjs 1.4.0 C:\caminho\VaiaAi-1.4.0.apk   -> cria vX.Y.Z como PRÉ-LANÇAMENTO (teste)
//   node scripts/github-release.mjs 1.4.0 --oficial                     -> marca como versão oficial (a mais recente)
// Usa o login do git deste PC (Gerenciador de Credenciais); o token não é impresso.
// No fim mostra tamanho e MD5 para colar em release/android.json. Ver AGENTS.md, "Lançar versão nova do APK".
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const [version, arg] = process.argv.slice(2);
if (!version || !arg) throw new Error('uso: node scripts/github-release.mjs <versao> <arquivo.apk | --oficial>');

const token = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' })
  .toString()
  .match(/^password=(.+)$/m)?.[1];
if (!token) throw new Error('sem login do GitHub neste PC (faça um git push uma vez para logar)');

const repo = 'rafablauth1/Chega-A-';
const api = `https://api.github.com/repos/${repo}`;
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'vaiaai', Accept: 'application/vnd.github+json' };
const tag = `v${version}`;
const name = `VaiaAi-${version}.apk`;

let rel = await fetch(`${api}/releases/tags/${tag}`, { headers });

if (arg === '--oficial') {
  const r = await rel.json();
  if (!r.id) throw new Error(`release ${tag} não existe`);
  const res = await fetch(`${api}/releases/${r.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prerelease: false, make_latest: 'true', name: `Vaia Aí ${version}` }),
  });
  console.log('oficial:', res.status === 200 ? 'OK' : await res.text());
  process.exit(0);
}

const apk = readFileSync(arg);
if (rel.status === 404) {
  rel = await fetch(`${api}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: tag, target_commitish: 'main', name: `Vaia Aí ${version} (teste)`, prerelease: true, make_latest: 'false' }),
  });
}
const r = await rel.json();
if (!r.id) throw new Error(`release: ${JSON.stringify(r).slice(0, 300)}`);
const old = (r.assets ?? []).find((a) => a.name === name);
if (old) await fetch(`${api}/releases/assets/${old.id}`, { method: 'DELETE', headers });

const up = await fetch(`https://uploads.github.com/repos/${repo}/releases/${r.id}/assets?name=${encodeURIComponent(name)}`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': String(statSync(arg).size) },
  body: apk,
});
const a = await up.json();
if (!a.browser_download_url) throw new Error(`upload: ${JSON.stringify(a).slice(0, 300)}`);
console.log('release:', r.html_url, r.prerelease ? '(teste)' : '');
console.log('url:      ', a.browser_download_url);
console.log('sizeBytes:', apk.length);
console.log('md5:      ', createHash('md5').update(apk).digest('hex'));
