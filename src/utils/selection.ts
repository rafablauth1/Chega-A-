import type { Game, Player, Position } from '../types';
import { formatGameDate } from './format';
import { displayName, teamName } from './names';
import { confirmedIds, matchScore } from './stats';

export interface RoundScore {
  player: Player;
  score: number;
  goals: number;
  assists: number;
}

/** Pontuação do jogador no dia: nota + gols + assistências + bônus de craque. */
export function roundScores(game: Game, byId: Record<string, Player>): RoundScore[] {
  return confirmedIds(game)
    .map((id) => byId[id])
    .filter(Boolean)
    .map((player) => {
      let goals = 0;
      let assists = 0;
      for (const m of game.matches) {
        for (const g of m.goals) {
          if (g.playerId === player.id && !g.ownGoal) goals++;
          if (g.assistId === player.id) assists++;
        }
      }
      const rating = game.ratings[player.id] ?? 3;
      const score = rating + goals * 0.6 + assists * 0.35 + (game.mvp === player.id ? 1 : 0);
      return { player, score, goals, assists };
    })
    .sort((a, b) => b.score - a.score);
}

const FORMATION: [Position, number][] = [
  ['GOL', 1],
  ['ZAG', 2],
  ['MEI', 2],
  ['ATA', 2],
];

/** Seleção da rodada (1-2-2-2): os melhores de cada posição, completando com os melhores restantes. */
export function roundSelection(game: Game, byId: Record<string, Player>) {
  const scores = roundScores(game, byId);
  const chosen: RoundScore[] = [];
  for (const [pos, n] of FORMATION) {
    chosen.push(...scores.filter((s) => s.player.position === pos).slice(0, n));
  }
  const missing = 7 - chosen.length;
  if (missing > 0) {
    chosen.push(...scores.filter((s) => !chosen.includes(s) && s.player.position !== 'GOL').slice(0, missing));
  }
  return chosen;
}

/** Texto da súmula do dia para compartilhar. */
export function summaryText(game: Game, byId: Record<string, Player>, groupName: string) {
  const name = (id?: string | null) => (id && byId[id] ? displayName(byId[id]) : '?');
  const lines = [`⚽ *${groupName}* · ${formatGameDate(game.date)}`];
  if (game.location) lines.push(`📍 ${game.location}`);

  if (game.matches.length) {
    lines.push('', '*Partidas*');
    game.matches.forEach((m, i) => {
      const [a, b] = matchScore(m);
      lines.push(`${i + 1}ª ${teamName(m.teamA)} ${a} x ${b} ${teamName(m.teamB)}`);
    });
  }

  const scores = roundScores(game, byId);
  const scorers = scores.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals);
  if (scorers.length) {
    lines.push('', '*Artilharia*');
    scorers.slice(0, 5).forEach((s) => lines.push(`⚽ ${displayName(s.player)} (${s.goals})`));
  }
  const waiters = scores.filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists);
  if (waiters.length) lines.push('', `🅰️ Garçom: ${displayName(waiters[0].player)} (${waiters[0].assists})`);
  if (game.mvp) lines.push(`🏆 Craque do jogo: ${name(game.mvp)}`);

  const sel = roundSelection(game, byId);
  if (sel.length && game.matches.length) {
    lines.push('', '*Seleção da rodada*', sel.map((s) => displayName(s.player)).join(', '));
  }
  return lines.join('\n');
}
