import type { Game, Player } from '../types';
import { matchScore } from './stats';

export const displayName = (p: Player) => p.nickname || p.name;
export const teamName = (i: number) => `Time ${i + 1}`;

/**
 * Próximo confronto no esquema "quem ganha fica": o vencedor da última partida
 * enfrenta o time que está esperando há mais tempo. Empate: sai quem jogou 2 seguidas.
 */
export function nextPair(game: Game): [number, number] {
  const n = game.teams?.length ?? 0;
  if (n < 2) return [0, 1];
  const last = [...game.matches].reverse().find((m) => m.finished);
  if (!last) return [0, 1];
  if (n === 2) return [last.teamA, last.teamB];

  // Há quanto tempo cada time não joga
  const lastPlayed = Array(n).fill(-1) as number[];
  game.matches.forEach((m, i) => {
    lastPlayed[m.teamA] = i;
    lastPlayed[m.teamB] = i;
  });
  const waiting = [...Array(n).keys()]
    .filter((t) => t !== last.teamA && t !== last.teamB)
    .sort((x, y) => lastPlayed[x] - lastPlayed[y])[0];

  const [a, b] = matchScore(last);
  const stays = a > b ? last.teamA : b > a ? last.teamB : last.teamB; // empate: o desafiante fica
  return [stays, waiting];
}
