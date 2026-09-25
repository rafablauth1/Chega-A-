import type { Game, Player } from '../types';

export const skillAverage = (p: Player) => {
  const v = Object.values(p.skills);
  return v.reduce((a, b) => a + b, 0) / v.length;
};

/** Média das notas pós-jogo de um jogador (últimos 10 jogos avaliados). */
export const gameRatingAverage = (playerId: string, games: Game[]) => {
  const notes = [...games]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((g) => g.ratings?.[playerId])
    .filter((n): n is number => typeof n === 'number')
    .slice(0, 10);
  if (!notes.length) return null;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
};

/**
 * Nota geral usada no sorteio: 60% habilidades + 40% desempenho nos jogos
 * (quando houver avaliações pós-jogo).
 */
export const overallRating = (p: Player, games: Game[]) => {
  const skills = skillAverage(p);
  const perf = gameRatingAverage(p.id, games);
  return perf === null ? skills : skills * 0.6 + perf * 0.4;
};

export const buildRatingMap = (players: Player[], games: Game[]) =>
  Object.fromEntries(players.map((p) => [p.id, overallRating(p, games)])) as Record<string, number>;
