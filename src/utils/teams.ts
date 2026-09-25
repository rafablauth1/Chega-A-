import type { Player, Position } from '../types';

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Tamanho de cada time: times completos e, se sobrar gente, um último time menor. */
export const teamSizes = (total: number, perTeam: number) => {
  const size = Math.max(1, perTeam);
  const full = Math.floor(total / size);
  const rest = total % size;
  const sizes = Array(Math.max(full, 1)).fill(size) as number[];
  if (full === 0) sizes[0] = total;
  else if (rest) sizes.push(rest);
  if (sizes.length === 1 && total >= 2) {
    // Sempre ao menos 2 times
    return [Math.ceil(total / 2), Math.floor(total / 2)];
  }
  return sizes;
};

const LINE: Position[] = ['ZAG', 'MEI', 'ATA'];

const score = (teams: Player[][], rating: Record<string, number>, sizes: number[]) => {
  const avgs = teams.map((t) => (t.length ? t.reduce((s, p) => s + rating[p.id], 0) / t.length : 0));
  // Compara os times completos; o time "resto" (menor) só entra se não houver 2 completos
  const isFull = (i: number) => sizes[i] === sizes[0];
  const useAll = sizes.filter((_, i) => isFull(i)).length < 2;
  const full = teams.filter((_, i) => useAll || isFull(i));
  const fullAvgs = avgs.filter((_, i) => useAll || isFull(i));
  const spread = Math.max(...fullAvgs) - Math.min(...fullAvgs);
  // Penalidade por times com posições muito desiguais
  let positionPenalty = 0;
  for (const pos of LINE) {
    const counts = full.map((t) => t.filter((p) => p.position === pos).length);
    positionPenalty += Math.max(...counts) - Math.min(...counts);
  }
  return spread + positionPenalty * 0.08;
};

/**
 * Sorteia times equilibrados pela nota. Goleiros são distribuídos um por time
 * (quando houver). Roda várias tentativas aleatórias e fica com a mais equilibrada,
 * assim cada sorteio gera times diferentes mas justos.
 */
export function drawTeams(players: Player[], perTeam: number, rating: Record<string, number>): string[][] {
  if (players.length === 0) return [];
  const sizes = teamSizes(players.length, perTeam);
  const n = sizes.length;
  let best: Player[][] = [];
  let bestScore = Infinity;

  for (let iter = 0; iter < 400; iter++) {
    const teams: Player[][] = sizes.map(() => []);
    const keepers = shuffle(players.filter((p) => p.position === 'GOL'));
    const gkTeams = shuffle(sizes.map((_, i) => i));
    keepers.slice(0, n).forEach((gk, i) => teams[gkTeams[i]].push(gk));

    const rest = [...players.filter((p) => !teams.flat().includes(p))]
      .map((p) => ({ p, k: rating[p.id] + Math.random() * 0.8 }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.p);

    for (const p of rest) {
      let target = -1;
      let lowest = Infinity;
      for (let i = 0; i < n; i++) {
        if (teams[i].length >= sizes[i]) continue;
        // Compara força relativa ao tamanho alvo do time
        const strength = teams[i].reduce((s, x) => s + rating[x.id], 0) / sizes[i];
        const tie = Math.random() * 0.01;
        if (strength + tie < lowest) {
          lowest = strength + tie;
          target = i;
        }
      }
      teams[target].push(p);
    }

    const s = score(teams, rating, sizes);
    if (s < bestScore) {
      bestScore = s;
      best = teams;
    }
  }

  const order: Record<Position, number> = { GOL: 0, ZAG: 1, MEI: 2, ATA: 3 };
  return best.map((t) => [...t].sort((a, b) => order[a.position] - order[b.position]).map((p) => p.id));
}

export const teamAverage = (ids: string[], rating: Record<string, number>) =>
  ids.length ? ids.reduce((s, id) => s + (rating[id] ?? 0), 0) / ids.length : 0;
