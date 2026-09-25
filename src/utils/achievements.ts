import type { Game } from '../types';
import { computeStats, confirmedIds, matchScore } from './stats';

export interface Achievement {
  key: string;
  icon: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unlocked: boolean;
}

/** Conquistas de um jogador, com progresso, calculadas a partir dos jogos já realizados. */
export function achievementsFor(playerId: string, games: Game[], nowIso: string): Achievement[] {
  const played = games.filter((g) => g.date <= nowIso).sort((a, b) => a.date.localeCompare(b.date));
  const s = computeStats(played, nowIso)[playerId] ?? { games: 0, goals: 0, assists: 0, mvps: 0, wins: 0, draws: 0, losses: 0 };

  // Maior sequência de jogos seguidos
  let streak = 0;
  let best = 0;
  for (const g of played) {
    streak = confirmedIds(g).includes(playerId) ? streak + 1 : 0;
    best = Math.max(best, streak);
  }

  // Mais gols num mesmo dia, jogos sem sofrer gol, nota máxima
  let bestDay = 0;
  let cleanSheets = 0;
  let fives = 0;
  for (const g of played) {
    let day = 0;
    for (const m of g.matches) {
      day += m.goals.filter((x) => x.playerId === playerId && !x.ownGoal).length;
      if (!m.finished || !g.teams) continue;
      const [a, b] = matchScore(m);
      if (g.teams[m.teamA]?.includes(playerId) && b === 0) cleanSheets++;
      if (g.teams[m.teamB]?.includes(playerId) && a === 0) cleanSheets++;
    }
    bestDay = Math.max(bestDay, day);
    if (g.ratings[playerId] === 5) fives++;
  }

  const list: Omit<Achievement, 'unlocked'>[] = [
    { key: 'estreia', icon: '🎽', title: 'Estreante', description: 'Jogou a primeira pelada', current: s.games, target: 1 },
    { key: 'fiel', icon: '🫡', title: 'Fiel', description: '10 jogos disputados', current: s.games, target: 10 },
    { key: 'sequencia', icon: '🔥', title: 'Não falta nunca', description: '5 jogos seguidos', current: best, target: 5 },
    { key: 'matador', icon: '🎯', title: 'Matador', description: '10 gols marcados', current: s.goals, target: 10 },
    { key: 'hattrick', icon: '🎩', title: 'Hat-trick', description: '3 gols no mesmo dia', current: bestDay, target: 3 },
    { key: 'garcom', icon: '🍽️', title: 'Garçom', description: '10 assistências', current: s.assists, target: 10 },
    { key: 'craque', icon: '🏆', title: 'Craque', description: 'Eleito craque do jogo 3 vezes', current: s.mvps, target: 3 },
    { key: 'vencedor', icon: '💪', title: 'Vencedor', description: '10 partidas vencidas', current: s.wins, target: 10 },
    { key: 'muralha', icon: '🧱', title: 'Muralha', description: '5 partidas sem sofrer gol', current: cleanSheets, target: 5 },
    { key: 'show', icon: '⭐', title: 'Show de bola', description: 'Recebeu nota 5 em um jogo', current: fives, target: 1 },
  ];

  return list.map((a) => ({ ...a, current: Math.min(a.current, a.target), unlocked: a.current >= a.target }));
}
