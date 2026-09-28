import { supabase } from './lib/supabase';
import type { VoteTotals } from './types';

/** Avaliação pós-jogo pela galera (ver supabase/migrations/011_match_votes.sql). */

/** Soma dos votos de todos os jogos do grupo. Sem a migração 011, devolve vazio. */
export async function fetchVoteTotals(groupId: string): Promise<Record<string, { votes: Record<string, VoteTotals>; voters: number }>> {
  const { data, error } = await supabase.rpc('group_vote_totals', { grp: groupId });
  if (error) return {};
  const out: Record<string, { votes: Record<string, VoteTotals>; voters: number }> = {};
  for (const r of (data ?? []) as any[]) {
    const g = (out[r.game_id] ??= { votes: {}, voters: 0 });
    g.voters = Math.max(g.voters, Number(r.voters) || 0);
    g.votes[r.target] = { ownSum: Number(r.own_sum), ownN: r.own_n, oppSum: Number(r.opp_sum), oppN: r.opp_n };
  }
  return out;
}

/** As notas que EU dei neste jogo (para mostrar e poder corrigir dentro do prazo). */
export async function myVotes(gameId: string, me: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('game_votes').select('target, score').eq('game_id', gameId).eq('voter', me);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: any) => [r.target, Number(r.score)]));
}

export async function submitVotes(gameId: string, groupId: string, me: string, scores: Record<string, number>) {
  const rows = Object.entries(scores).map(([target, score]) => ({ game_id: gameId, group_id: groupId, voter: me, target, score }));
  const { error } = await supabase.from('game_votes').upsert(rows, { onConflict: 'game_id,voter,target' });
  if (error) throw error;
}

export function voteError(message = '') {
  if (/rate limit/i.test(message)) return 'Muitas ações seguidas. Espere um pouco e tente de novo.';
  if (/row-level security|violates|permission/i.test(message))
    return 'O prazo de avaliação acabou, o jogo não foi encerrado ou você não jogou esta pelada.';
  if (/Could not find|does not exist|schema cache/i.test(message)) return 'O servidor ainda não tem as avaliações. Rode a migração 011 no Supabase.';
  if (/network|fetch/i.test(message)) return 'Sem conexão. As notas não foram enviadas.';
  return 'Não deu certo. Tente de novo.';
}
