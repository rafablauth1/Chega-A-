import type { Game, Match } from '../types';

/** Quem está dentro das vagas (por ordem de confirmação). */
export const confirmedIds = (g: Game) => (g.maxPlayers > 0 ? g.attendees.slice(0, g.maxPlayers) : g.attendees);
/** Quem ficou na lista de espera. */
export const waitlistIds = (g: Game) => (g.maxPlayers > 0 ? g.attendees.slice(g.maxPlayers) : []);

export const matchScore = (m: Match) => [
  m.goals.filter((x) => x.team === m.teamA).length,
  m.goals.filter((x) => x.team === m.teamB).length,
];

export interface PlayerStats {
  games: number;
  goals: number;
  assists: number;
  mvps: number;
  wins: number;
  draws: number;
  losses: number;
}

const emptyStats = (): PlayerStats => ({ games: 0, goals: 0, assists: 0, mvps: 0, wins: 0, draws: 0, losses: 0 });

/**
 * Estatísticas por jogador. `games` conta só jogos que já aconteceram.
 * Vitórias/empates/derrotas vêm das partidas encerradas usando os times sorteados.
 */
export function computeStats(games: Game[], untilIso: string) {
  const stats: Record<string, PlayerStats> = {};
  const get = (id: string) => (stats[id] ??= emptyStats());

  for (const g of games) {
    if (g.date > untilIso) continue;
    confirmedIds(g).forEach((id) => get(id).games++);
    if (g.mvp) get(g.mvp).mvps++;
    for (const m of g.matches) {
      for (const goal of m.goals) {
        if (goal.playerId && !goal.ownGoal) get(goal.playerId).goals++;
        if (goal.assistId) get(goal.assistId).assists++;
      }
      if (!m.finished || !g.teams) continue;
      const [a, b] = matchScore(m);
      const res = (mine: number, other: number) => (mine > other ? 'wins' : mine < other ? 'losses' : 'draws');
      g.teams[m.teamA]?.forEach((id) => get(id)[res(a, b)]++);
      g.teams[m.teamB]?.forEach((id) => get(id)[res(b, a)]++);
    }
  }
  return stats;
}
