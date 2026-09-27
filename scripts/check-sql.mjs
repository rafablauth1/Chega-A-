/**
 * Confere a sintaxe dos arquivos SQL do Supabase com o parser oficial do Postgres (libpg-query).
 * Rodar: npm run check:sql   — não precisa de banco nem de internet.
 * Pega erros de digitação e palavras reservadas; regras de negócio só dá para testar no Supabase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { parse, parsePlPgSQL } from 'libpg-query';

const files = ['supabase/schema.sql', ...readdirSync('supabase/migrations').sort().map((f) => `supabase/migrations/${f}`)];
let failed = 0;
for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  try {
    const { stmts } = await parse(sql);
    await parsePlPgSQL(sql); // corpo das funções em plpgsql
    console.log(`ok    ${f} (${stmts.length} comandos)`);
  } catch (e) {
    failed++;
    console.log(`ERRO  ${f}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
