import type { Game, Player } from '../types';
import { liveSkills, notaOf } from './scoring';

export const skillAverage = (p: Pick<Player, 'skills'>) => {
  const v = Object.values(p.skills);
  return v.reduce((a, b) => a + b, 0) / v.length;
};

/** Força interna (1–5, das estrelas de habilidade) mostrada como nota de 0 a 10. */
export const toTen = (r: number) => r * 2;

/** Colore uma nota de 0 a 10: vermelho, amarelo, verde. */
export const scoreColor = (n: number) => (n >= 7 ? '#5BD08A' : n >= 5 ? '#F4C542' : '#FF5A4E');

/**
 * Média da nota pós-jogo (0 a 10) de um jogador nos últimos 10 jogos avaliados.
 * A nota é a da galera (votos com peso companheiro/adversário) ou, sem votos, a do organizador.
 */
export const gameRatingAverage = (playerId: string, games: Game[]) => {
  const notes = [...games]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((g) => notaOf(g, playerId).nota)
    .filter((n): n is number => typeof n === 'number')
    .slice(0, 10);
  if (!notes.length) return null;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
};

/**
 * Nota geral usada no sorteio: 60% atributos (já atualizados pelos jogos) + 40% nota da galera
 * (quando houver avaliações).
 */
export const overallRating = (p: Player, games: Game[]) => {
  const skills = skillAverage(liveSkills(p, games));
  const perf = gameRatingAverage(p.id, games);
  // perf vem de 0 a 10; volta para a escala 1–5 das habilidades
  return perf === null ? skills : skills * 0.6 + (perf / 2) * 0.4;
};

export const buildRatingMap = (players: Player[], games: Game[]) =>
  Object.fromEntries(players.map((p) => [p.id, overallRating(p, games)])) as Record<string, number>;
