/**
 * Auditoria estática de segurança do banco (schema.sql + migrations em ordem).
 *   npm run check:db
 *
 * Aponta:
 *  - tabela em public SEM "enable row level security" (dados abertos para qualquer um com a chave pública)
 *  - tabela com RLS mas SEM nenhuma policy (ninguém acessa: normalmente é bug, a não ser que seja proposital)
 *  - função SECURITY DEFINER sem "set search_path" (dá para sequestrar com objetos de mesmo nome)
 *  - função SECURITY DEFINER que recebe ids de usuários e não usa auth.uid() (pode vazar dado de terceiros)
 *  - policy "using (true)" em tabela que não está na lista de tabelas públicas conhecidas
 * Sai com código 1 se achar problema grave. Os avisos (⚠) são para revisão humana.
 */
import { readdirSync, readFileSync } from 'node:fs';

const files = ['supabase/schema.sql', ...readdirSync('supabase/migrations').sort().map((f) => `supabase/migrations/${f}`)];
const sql = files.map((f) => `\n-- @@file ${f}\n` + readFileSync(f, 'utf8')).join('\n').replace(/--[^\n]*/g, (c) => (c.startsWith('-- @@file') ? c : ''));

// Tabelas que podem ser lidas por todos de propósito (configurações sem dado pessoal)
const PUBLIC_READ = new Set(['security_settings', 'app_settings']);
// Funções definer que podem receber ids sem auth.uid() porque são só cálculo/consulta interna segura
const DEFINER_OK = new Set(['km_between', 'team_index', 'handle_new_user', 'handle_new_group', 'handle_new_community', 'rate_limit', 'touch_vote', 'stamp_game_closed']);
// Revisados à mão (motivo registrado). Coisa NOVA que aparecer continua sendo apontada.
const REVIEWED = {
  'função recovery_pending': 'execute revogado de anon/authenticated (migração 010): só o servidor chama',
  'função sync_group_to_community': 'execute revogado de anon/authenticated (migração 017): só gatilhos chamam',
  'função is_adult': 'só revela "é maior de 18"; usada pela descoberta, que já exige 18+ de quem procura',
  'tabela public.password_tickets': 'de propósito: só funções do servidor (senha) acessam',
  'tabela public.reset_attempts': 'de propósito: só funções do servidor (senha) acessam',
  'tabela public.password_changes': 'de propósito: só funções do servidor (senha) acessam',
};
const reviewed = (msg) => Object.keys(REVIEWED).find((k) => msg.startsWith(k));

const tables = new Set();
for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) tables.add(m[1].toLowerCase());
const rls = new Set();
for (const m of sql.matchAll(/alter table (?:if exists )?public\.(\w+)\s+enable row level security/gi)) rls.add(m[1].toLowerCase());
// laços "foreach t in array array['a','b'] ... enable row level security"
for (const m of sql.matchAll(/array\[([^\]]+)\][\s\S]{0,400}?enable row level security/gi))
  for (const t of m[1].matchAll(/'(\w+)'/g)) rls.add(t[1].toLowerCase());

const policies = {};
for (const m of sql.matchAll(/create policy "[^"]+" on (?:public\.)?(\w+)[\s\S]*?;/gi)) (policies[m[1].toLowerCase()] ??= []).push(m[0]);
for (const m of sql.matchAll(/array\[([^\]]+)\][\s\S]{0,600}?create policy/gi))
  for (const t of m[1].matchAll(/'(\w+)'/g)) (policies[t[1].toLowerCase()] ??= []).push('(laço)');

const problems = [];
const warnings = [];

for (const t of tables) {
  if (!rls.has(t)) problems.push(`tabela public.${t} sem RLS`);
  else if (!policies[t]?.length) warnings.push(`tabela public.${t} com RLS e nenhuma policy (só funções do servidor acessam)`);
  for (const p of policies[t] ?? []) {
    if (/using\s*\(\s*true\s*\)/i.test(p) && !PUBLIC_READ.has(t)) warnings.push(`policy aberta (using true) em public.${t}`);
  }
}

// Última definição de cada função vale
const fns = {};
for (const m of sql.matchAll(/create or replace function public\.(\w+)\s*\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$/gi)) {
  fns[m[1].toLowerCase()] = { args: m[2], header: m[3], body: m[4] };
}
for (const [name, f] of Object.entries(fns)) {
  if (!/security definer/i.test(f.header)) continue;
  if (!/set search_path/i.test(f.header)) problems.push(`função ${name}() é SECURITY DEFINER sem set search_path`);
  const takesUser = /\b(uuid|text)\b/i.test(f.args) && f.args.trim() !== '';
  if (takesUser && !DEFINER_OK.has(name) && !/auth\.uid\(\)|auth\.jwt\(\)|group_role\(|is_group_admin\(|community_role\(/i.test(f.body))
    warnings.push(`função ${name}(${f.args.trim()}) é DEFINER, recebe ids e não confere quem chama (auth.uid)`);
}

console.log(`tabelas: ${tables.size} · com RLS: ${[...tables].filter((t) => rls.has(t)).length} · funções: ${Object.keys(fns).length}`);
for (const w of warnings) {
  const k = reviewed(w);
  console.log(k ? `✓  ${w} — revisado: ${REVIEWED[k]}` : `⚠  ${w}`);
}
for (const p of problems) console.log(`✖  ${p}`);
if (problems.length) {
  console.log(`\n${problems.length} problema(s) grave(s).`);
  process.exit(1);
}
console.log(problems.length || warnings.length ? '\nok  sem problema grave (revise os avisos)' : 'ok  nada a apontar');
