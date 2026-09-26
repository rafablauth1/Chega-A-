import type { Game, Player } from '../types';

export const skillAverage = (p: Player) => {
  const v = Object.values(p.skills);
  return v.reduce((a, b) => a + b, 0) / v.length;
};

/** Força interna (1–5, das estrelas de habilidade) mostrada como nota de 0 a 10. */
export const toTen = (r: number) => r * 2;

/** Colore uma nota de 0 a 10: vermelho, amarelo, verde. */
export const scoreColor = (n: number) => (n >= 7 ? '#22C55E' : n >= 5 ? '#FACC15' : '#EF4444');

/** Média das notas pós-jogo (0 a 10) de um jogador, nos últimos 10 jogos avaliados. */
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
  // perf vem de 0 a 10; volta para a escala 1–5 das habilidades
  return perf === null ? skills : skills * 0.6 + (perf / 2) * 0.4;
};

export const buildRatingMap = (players: Player[], games: Game[]) =>
  Object.fromEntries(players.map((p) => [p.id, overallRating(p, games)])) as Record<string, number>;
