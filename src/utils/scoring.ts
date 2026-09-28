import { SCORING } from '../config/scoring';
import type { Game, Player, Position, Skills } from '../types';
import { confirmedIds } from './stats';

/**
 * Pontuação estilo Cartola. As regras e os pesos ficam em src/config/scoring.ts.
 * Tudo é calculado a partir dos dados do jogo (times, partidas, gols e votos), então muda sozinho
 * quando os pesos mudam, inclusive para jogos antigos.
 */

export type Highlight = 'craque' | 'bagre' | null;

export interface PlayerGameScore {
  playerId: string;
  team: number | null;
  /** Nota da galera (0 a 10) já com os pesos companheiro/adversário; null = ninguém avaliou ainda */
  nota: number | null;
  /** Quantos votos recebeu (ou 1 quando a nota é do organizador) */
  votes: number;
  /** De onde veio a nota */
  source: 'galera' | 'organizador' | null;
  wins: number;
  draws: number;
  losses: number;
  resultMult: number;
  goals: number;
  assists: number;
  /** Pontos de defesa por partida (média) */
  defense: number;
  scoutPoints: number;
  scoutFactor: number;
  highlight: Highlight;
  highlightMult: number;
  /** Pontuação final; null enquanto não há nota */
  points: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const teamOf = (game: Game, playerId: string): number | null => {
  const i = game.teams?.findIndex((t) => t.includes(playerId)) ?? -1;
  return i >= 0 ? i : null;
};

/** Quem participou: os times sorteados, ou a lista de confirmados se não houve sorteio. */
export const participantsOf = (game: Game): string[] =>
  game.teams?.length ? [...new Set(game.teams.flat())] : confirmedIds(game);

/** Nota ponderada: votos da galera primeiro; sem votos, a nota do organizador (jogos antigos / modo sem conta). */
export function notaOf(game: Game, playerId: string): { nota: number | null; votes: number; source: PlayerGameScore['source'] } {
  const v = game.votes?.[playerId];
  const { ownTeamWeight: wo, opponentWeight: wa } = SCORING.votes;
  if (v && v.ownN + v.oppN > 0) {
    const nota = (wo * v.ownSum + wa * v.oppSum) / (wo * v.ownN + wa * v.oppN);
    return { nota: round2(nota), votes: v.ownN + v.oppN, source: 'galera' };
  }
  const org = game.ratings?.[playerId];
  if (typeof org === 'number' && org > 0) return { nota: org, votes: 1, source: 'organizador' };
  return { nota: null, votes: 0, source: null };
}

/** Pontuação de todos os participantes de um jogo. */
export function scoreGame(game: Game, positionOf: (id: string) => Position | undefined): Record<string, PlayerGameScore> {
  const S = SCORING;
  const out: Record<string, PlayerGameScore> = {};

  for (const id of participantsOf(game)) {
    const team = teamOf(game, id);
    let goals = 0;
    let assists = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const defenses: number[] = [];

    for (const m of game.matches) {
      for (const g of m.goals) {
        if (g.playerId === id && !g.ownGoal) goals++;
        if (g.assistId === id) assists++;
      }
      if (team === null || (m.teamA !== team && m.teamB !== team)) continue;
      const other = m.teamA === team ? m.teamB : m.teamA;
      const scored = m.goals.filter((g) => g.team === team).length;
      const conceded = m.goals.filter((g) => g.team === other).length;
      defenses.push(S.scout.concededPoints[Math.min(conceded, S.scout.concededPoints.length - 1)]);
      if (!m.finished) continue;
      if (scored > conceded) wins++;
      else if (scored < conceded) losses++;
      else draws++;
    }

    const played = wins + draws + losses;
    const resultMult = played ? (wins * S.result.win + draws * S.result.draw + losses * S.result.loss) / played : 1;
    const defense = defenses.length ? defenses.reduce((a, b) => a + b, 0) / defenses.length : 0;
    const pos = S.scout.byPosition[positionOf(id) ?? 'MEI'] ?? S.scout.byPosition.MEI;
    const scoutPoints = pos.attack * (goals * S.scout.goal + assists * S.scout.assist) + pos.defense * defense;
    const scoutFactor = Math.min(S.scout.maxFactor, 1 + scoutPoints * S.scout.factorPerPoint);
    const { nota, votes, source } = notaOf(game, id);

    out[id] = {
      playerId: id,
      team,
      nota,
      votes,
      source,
      wins,
      draws,
      losses,
      resultMult: round2(resultMult),
      goals,
      assists,
      defense: round2(defense),
      scoutPoints: round2(scoutPoints),
      scoutFactor: round2(scoutFactor),
      highlight: null,
      highlightMult: 1,
      points: nota === null ? null : nota * resultMult * scoutFactor,
    };
  }

  // Craque e bagre de cada time (maior e menor pontuação antes do destaque)
  const teams = new Map<number, PlayerGameScore[]>();
  Object.values(out).forEach((s) => s.team !== null && s.points !== null && teams.set(s.team, [...(teams.get(s.team) ?? []), s]));
  for (const list of teams.values()) {
    if (list.length < S.highlight.minTeamSize) continue;
    const sorted = [...list].sort((a, b) => b.points! - a.points!);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.points! <= worst.points!) continue;
    best.highlight = 'craque';
    best.highlightMult = S.highlight.craque;
    worst.highlight = 'bagre';
    worst.highlightMult = S.highlight.bagre;
  }
  Object.values(out).forEach((s) => {
    if (s.points !== null) s.points = round1(s.points * s.highlightMult);
  });
  return out;
}

/** Situação da votação de um jogo. */
export function voteStatus(game: Game, now = Date.now()) {
  if (!game.closedAt) return { state: 'not-closed' as const, deadline: null, hoursLeft: 0 };
  const deadline = new Date(game.closedAt).getTime() + SCORING.votes.windowHours * 3600_000;
  const left = deadline - now;
  return left > 0
    ? { state: 'open' as const, deadline: new Date(deadline), hoursLeft: Math.ceil(left / 3600_000) }
    : { state: 'finished' as const, deadline: new Date(deadline), hoursLeft: 0 };
}

export interface SeasonScore {
  games: number;
  total: number;
  average: number;
  craques: number;
  bagres: number;
  /** Média da nota da galera (0 a 10) */
  nota: number | null;
}

/** Soma da temporada (para o ranking). Só conta jogos em que o jogador teve pontuação. */
export function seasonScores(games: Game[], positionOf: (id: string) => Position | undefined) {
  const acc: Record<string, { pts: number[]; notas: number[]; craques: number; bagres: number }> = {};
  for (const g of games) {
    for (const s of Object.values(scoreGame(g, positionOf))) {
      if (s.points === null) continue;
      const a = (acc[s.playerId] ??= { pts: [], notas: [], craques: 0, bagres: 0 });
      a.pts.push(s.points);
      if (s.nota !== null) a.notas.push(s.nota);
      if (s.highlight === 'craque') a.craques++;
      if (s.highlight === 'bagre') a.bagres++;
    }
  }
  const out: Record<string, SeasonScore> = {};
  for (const [id, a] of Object.entries(acc)) {
    const total = a.pts.reduce((x, y) => x + y, 0);
    out[id] = {
      games: a.pts.length,
      total: round1(total),
      average: round1(total / a.pts.length),
      craques: a.craques,
      bagres: a.bagres,
      nota: a.notas.length ? round1(a.notas.reduce((x, y) => x + y, 0) / a.notas.length) : null,
    };
  }
  return out;
}

const clamp = (n: number, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, n));

/**
 * Atributos atualizados pelos jogos: parte vem do perfil (autoavaliação/organizador) e parte do
 * desempenho nos últimos jogos avaliados. Quanto mais jogos, mais pesa o desempenho (até o limite do config).
 */
export function liveSkills(player: Player, games: Game[]): { skills: Skills; games: number; weight: number } {
  const recent = [...games]
    .filter((g) => participantsOf(g).includes(player.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((g) => scoreGame(g, (id) => (id === player.id ? player.position : undefined))[player.id])
    .filter((s): s is PlayerGameScore => !!s && s.nota !== null)
    .slice(0, SCORING.attributes.gamesForFullWeight);

  const n = recent.length;
  if (!n) return { skills: player.skills, games: 0, weight: 0 };
  const avg = (f: (s: PlayerGameScore) => number) => recent.reduce((a, s) => a + f(s), 0) / n;

  const nota5 = avg((s) => s.nota!) / 2; // 0 a 5
  const target: Skills = {
    tecnica: clamp(nota5),
    fisico: clamp((nota5 + clamp(1 + ((avg((s) => s.resultMult) - SCORING.result.loss) / (SCORING.result.win - SCORING.result.loss)) * 4)) / 2),
    passe: clamp(2.5 + avg((s) => s.assists) * 2),
    finalizacao: clamp(2.5 + avg((s) => s.goals) * 1.5),
    defesa: clamp(1 + (avg((s) => s.defense) / SCORING.scout.concededPoints[0]) * 4),
  };
  const weight = Math.min(n / SCORING.attributes.gamesForFullWeight, 1) * SCORING.attributes.maxPerformanceWeight;
  const mix = (k: keyof Skills) => round1(player.skills[k] * (1 - weight) + target[k] * weight);
  return {
    skills: { tecnica: mix('tecnica'), fisico: mix('fisico'), passe: mix('passe'), finalizacao: mix('finalizacao'), defesa: mix('defesa') },
    games: n,
    weight,
  };
}
