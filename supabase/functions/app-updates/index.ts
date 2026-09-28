// Função "app-updates": entrega as atualizações automáticas do app (expo-updates).
//
// As atualizações ficam NO GIT (pasta updates/ do repositório); esta função só busca o manifesto no
// GitHub e devolve com os cabeçalhos que o app exige (o GitHub sozinho não manda esses cabeçalhos).
// Cada manifesto vem ASSINADO (manifest.sig) com uma chave que fica só no PC do dono: se alguém
// adulterar o GitHub ou esta função, o app recusa a atualização.
//
// Como publicar (uma vez só), no painel do Supabase:
//   Edge Functions → Deploy a new function → Via Editor → nome: app-updates → colar este arquivo → Deploy
//   Depois, em Details (ou Settings) da função: desligar "Enforce JWT Verification" (o app não manda login aqui).
// Não precisa de nenhum segredo: tudo o que ela lê é público.

const REPO_RAW = 'https://raw.githubusercontent.com/rafablauth1/Chega-A-/main/updates';

const baseHeaders = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405 });

  const url = new URL(req.url);
  const platform = req.headers.get('expo-platform') ?? url.searchParams.get('platform') ?? '';
  const runtime = req.headers.get('expo-runtime-version') ?? url.searchParams.get('runtime-version') ?? '';

  // Só aceita valores simples (evita alguém montar caminhos estranhos no GitHub)
  if (!/^(android|ios)$/.test(platform) || !/^[0-9A-Za-z._-]{1,32}$/.test(runtime)) {
    return new Response('bad request', { status: 400 });
  }

  const base = `${REPO_RAW}/${platform}/${runtime}`;
  const [manifest, signature] = await Promise.all([fetch(`${base}/manifest.json`), fetch(`${base}/manifest.sig`)]);

  // Nenhuma atualização publicada para esta versão do app: "nada novo"
  if (manifest.status === 404) return new Response(null, { status: 204, headers: baseHeaders });
  if (!manifest.ok) return new Response('upstream error', { status: 502 });

  const body = await manifest.text();
  const headers: Record<string, string> = { ...baseHeaders, 'content-type': 'application/json; charset=utf-8' };
  if (signature.ok) headers['expo-signature'] = (await signature.text()).trim();

  return new Response(body, { headers });
});
