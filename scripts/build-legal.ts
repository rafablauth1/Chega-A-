/**
 * Gera as páginas públicas (docs/*.html) a partir de src/legal/content.ts.
 * Rodar: node scripts/build-legal.ts   (Node 22.6+ entende TypeScript direto)
 * Publicação: GitHub > Settings > Pages > Branch "main", pasta "/docs".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { APP_NAME, CONTACT_EMAIL, DELETE_ACCOUNT, PRIVACY, TERMS, UPDATED_AT, type LegalDoc } from '../src/legal/content.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const css = `
:root{--bg:#0F2419;--card:#16301F;--line:#27492F;--chalk:#F2F5EE;--muted:#9DB5A4;--accent:#FF7A1A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--chalk);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:40px 20px 80px}
a{color:var(--accent)}
header a{color:var(--muted);text-decoration:none;font-weight:600}
h1{font-size:2.2rem;line-height:1.15;margin:.6em 0 .3em}
h2{font-size:1.25rem;margin:2em 0 .5em}
p,li{color:var(--muted)}
.intro{color:var(--chalk);font-size:1.1rem}
.meta{font-size:.9rem}
ul{padding-left:1.2em}
li{margin:.35em 0}
nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:48px;padding-top:20px;border-top:1px solid var(--line);font-size:.95rem}
.cards{display:grid;gap:12px;margin-top:24px}
.cards a{display:block;background:var(--card);border-radius:14px;padding:18px 20px;color:var(--chalk);text-decoration:none;font-weight:600}
.cards span{display:block;color:var(--muted);font-weight:400;font-size:.95rem}
`;

const nav = `<nav><a href="index.html">Início</a><a href="privacidade.html">Privacidade</a><a href="termos.html">Termos de uso</a><a href="excluir-conta.html">Excluir conta</a></nav>`;

const page = (title: string, body: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${APP_NAME}</title>
<style>${css}</style>
</head>
<body><main>
<header><a href="index.html">⚽ ${APP_NAME}</a></header>
${body}
${nav}
</main></body>
</html>
`;

const render = (doc: LegalDoc) =>
  page(
    doc.title,
    `<h1>${esc(doc.title)}</h1>
<p class="intro">${esc(doc.intro)}</p>
<p class="meta">Atualizado em ${UPDATED_AT}</p>
${doc.sections
  .map(
    (s) =>
      `<h2>${esc(s.heading)}</h2>\n` +
      (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('\n') +
      (s.items?.length ? `\n<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''),
  )
  .join('\n')}`,
  );

const home = page(
  'Início',
  `<h1>${APP_NAME}</h1>
<p class="intro">O app para organizar a pelada com os amigos: lista de presença, sorteio de times, placar ao vivo, ranking e caixa do grupo.</p>
<div class="cards">
<a href="privacidade.html">Política de Privacidade<span>Quais dados usamos e como você controla.</span></a>
<a href="termos.html">Termos de Uso<span>As regras do jogo para usar o app.</span></a>
<a href="excluir-conta.html">Excluir conta<span>Como apagar sua conta e seus dados.</span></a>
</div>
<p class="meta" style="margin-top:32px">Contato: ${esc(CONTACT_EMAIL)}</p>`,
);

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', home);
for (const doc of [PRIVACY, TERMS, DELETE_ACCOUNT]) writeFileSync(`docs/${doc.slug}.html`, render(doc));
// Sem isso o GitHub Pages tenta processar a pasta com Jekyll
writeFileSync('docs/.nojekyll', '');
console.log('Páginas geradas em docs/');
