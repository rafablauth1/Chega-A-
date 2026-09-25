import { DEFAULT_SETTINGS, type Data } from '../store';
import type { Game, Goal, Match, Player, Position } from '../types';
import { monthKey, toLocalIso, uid } from './format';
import { skillAverage } from './rating';
import { drawTeams } from './teams';

const PEOPLE: [string, string, Position, 'mensalista' | 'avulso'][] = [
  ['Rafael Blauth', 'Rafa', 'MEI', 'mensalista'],
  ['Marcos Paulo Silva', 'Marcão', 'GOL', 'mensalista'],
  ['Diego Ferreira', 'Paredão', 'GOL', 'avulso'],
  ['Thiago Santos', 'Thiaguinho', 'ZAG', 'mensalista'],
  ['Lucas Oliveira', 'Luquinha', 'ZAG', 'mensalista'],
  ['Bruno Costa', 'Xerife', 'ZAG', 'avulso'],
  ['Felipe Almeida', 'Lipe', 'ZAG', 'mensalista'],
  ['Gustavo Rocha', 'Guga', 'ZAG', 'avulso'],
  ['André Souza', 'Dedé', 'MEI', 'mensalista'],
  ['Carlos Eduardo', 'Cadu', 'MEI', 'mensalista'],
  ['Leonardo Lima', 'Léo', 'MEI', 'avulso'],
  ['Mateus Ribeiro', 'Teteu', 'MEI', 'mensalista'],
  ['Rodrigo Martins', 'Digão', 'MEI', 'avulso'],
  ['Pedro Henrique', 'PH', 'MEI', 'mensalista'],
  ['João Victor', 'JV', 'ATA', 'mensalista'],
  ['Gabriel Barbosa', 'Gabigol', 'ATA', 'avulso'],
  ['Vinícius Araújo', 'Vini', 'ATA', 'mensalista'],
  ['Renato Gomes', 'Renatinho', 'ATA', 'avulso'],
  ['Eduardo Pires', 'Dudu', 'ATA', 'mensalista'],
  ['Fernando Castro', 'Nando', 'ATA', 'avulso'],
];

const rnd = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeSkills(pos: Position) {
  const base = rnd(2, 4);
  const s = (bias = 0) => Math.max(1, Math.min(5, base + bias + rnd(-1, 1)));
  return {
    tecnica: s(pos === 'MEI' || pos === 'ATA' ? 1 : 0),
    fisico: s(),
    passe: s(pos === 'MEI' ? 1 : 0),
    finalizacao: s(pos === 'ATA' ? 1 : pos === 'ZAG' || pos === 'GOL' ? -1 : 0),
    defesa: s(pos === 'ZAG' || pos === 'GOL' ? 1 : pos === 'ATA' ? -1 : 0),
  };
}

function playGame(game: Game, players: Player[], rating: Record<string, number>): Game {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const teams = drawTeams(game.attendees.map((id) => byId[id]), game.playersPerTeam, rating);
  const matches: Match[] = [];
  let a = 0;
  let b = 1;
  for (let i = 0; i < 5 && teams.length >= 2; i++) {
    const goals: Goal[] = [];
    for (const team of [a, b]) {
      const n = rnd(0, 3);
      for (let k = 0; k < n; k++) {
        const line = teams[team].filter((id) => byId[id].position !== 'GOL');
        const scorer = pick(line.filter((id) => byId[id].position !== 'ZAG').concat(line));
        const assist = Math.random() < 0.6 ? pick(line.filter((id) => id !== scorer)) : null;
        goals.push({ id: uid(), team, playerId: scorer, assistId: assist, minute: rnd(30, 590) });
      }
    }
    goals.sort((x, y) => (x.minute ?? 0) - (y.minute ?? 0));
    const match: Match = { id: uid(), teamA: a, teamB: b, goals, durationMin: 10, finished: true };
    matches.push(match);
    // Quem ganha fica
    const ga = goals.filter((g) => g.team === a).length;
    const gb = goals.filter((g) => g.team === b).length;
    const out = [...Array(teams.length).keys()].find((t) => t !== a && t !== b);
    if (out !== undefined) {
      if (ga > gb) b = out;
      else a = out;
      [a, b] = [Math.min(a, b), Math.max(a, b)];
    }
  }
  const ratings = Object.fromEntries(game.attendees.map((id) => [id, Math.max(1, Math.min(5, Math.round(rating[id]) + rnd(-1, 1)))]));
  const mvp = Object.entries(ratings).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  const paid = game.attendees.filter((id) => byId[id].type === 'avulso' && Math.random() < 0.75);
  return { ...game, teams, matches, ratings, mvp, paid };
}

/** Grupo de exemplo: 20 jogadores, 3 jogos passados com placar e 1 próximo jogo com lista montada. */
export function buildDemo(): Data {
  const now = new Date();
  const players: Player[] = PEOPLE.map(([name, nickname, position, type], i) => ({
    id: `demo-p${i}`,
    name,
    nickname,
    phone: '',
    position,
    type,
    skills: makeSkills(position),
    active: true,
    createdAt: now.toISOString(),
  }));
  const rating = Object.fromEntries(players.map((p) => [p.id, skillAverage(p)]));
  const ids = players.map((p) => p.id);

  const at = (daysFromNow: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(20, 0, 0, 0);
    return toLocalIso(d);
  };
  const base = {
    location: 'Arena Society - Quadra 2',
    pricePerPlayer: 25,
    playersPerTeam: 6,
    maxPlayers: 18,
    notes: '',
  };
  const emptyGame = (id: string, date: string, attendees: string[]): Game => ({
    ...base,
    id,
    date,
    attendees,
    paid: [],
    teams: null,
    ratings: {},
    matches: [],
  });
  const someone = (n: number) => {
    const keepers = ids.filter((id) => players.find((p) => p.id === id)!.position === 'GOL');
    const rest = ids.filter((id) => !keepers.includes(id)).sort(() => Math.random() - 0.5);
    return [...keepers, ...rest].slice(0, n);
  };

  const past = [-21, -14, -7].map((d, i) => playGame(emptyGame(`demo-${i + 1}`, at(d), someone(18)), players, rating));
  // Próximo jogo: 20 confirmados com limite de 18 → 2 na lista de espera
  const next = emptyGame('demo-next', at(3), someone(20));

  const month = monthKey(now);
  const mensalistas = players.filter((p) => p.type === 'mensalista').map((p) => p.id);

  return {
    players,
    games: [...past, next],
    expenses: [
      { id: uid(), date: at(-20).slice(0, 10), description: 'Aluguel da quadra', amount: 300 },
      { id: uid(), date: at(-6).slice(0, 10), description: 'Bola nova', amount: 150 },
      { id: uid(), date: at(-6).slice(0, 10), description: 'Coletes', amount: 90 },
    ],
    monthly: { [month]: mensalistas.slice(0, Math.ceil(mensalistas.length * 0.7)) },
    settings: { ...DEFAULT_SETTINGS, groupName: 'Pelada de Quinta', defaultLocation: base.location, defaultMaxPlayers: 18, defaultPrice: 25,
      pixKey: 'pelada@exemplo.com', pixName: 'Organizador Exemplo', pixCity: 'Sao Paulo' },
  };
}
