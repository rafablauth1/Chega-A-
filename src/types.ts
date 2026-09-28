export type Position = 'GOL' | 'ZAG' | 'MEI' | 'ATA';
export type PlayerType = 'mensalista' | 'avulso';

export interface Skills {
  tecnica: number;
  fisico: number;
  passe: number;
  finalizacao: number;
  defesa: number;
}

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  position: Position;
  type: PlayerType;
  skills: Skills;
  active: boolean;
  createdAt: string;
  /** Tem conta no app (membro do grupo); sem isso é um convidado cadastrado pelo admin */
  account?: boolean;
  /** URL da foto principal (só quem tem conta) */
  photo?: string;
}

export type Foot = 'D' | 'E' | 'A';

export const FEET: { key: Foot; label: string }[] = [
  { key: 'D', label: 'Destro' },
  { key: 'E', label: 'Canhoto' },
  { key: 'A', label: 'Ambidestro' },
];

export interface Goal {
  id: string;
  /** Índice do time que marcou */
  team: number;
  playerId: string | null;
  assistId?: string | null;
  ownGoal?: boolean;
  /** Segundos de jogo */
  minute?: number;
}

export interface Match {
  id: string;
  teamA: number;
  teamB: number;
  goals: Goal[];
  durationMin: number;
  finished: boolean;
}

export interface Game {
  id: string;
  /** Data/hora local de INÍCIO da quadra, no formato YYYY-MM-DDTHH:mm */
  date: string;
  /** Hora de FIM da quadra (HH:mm). Sem valor = 60 min depois do início. */
  endTime?: string;
  /** Duração de cada partida em minutos (ex.: 3 partidas de 20 min numa hora de quadra) */
  matchMinutes?: number;
  location: string;
  pricePerPlayer: number;
  playersPerTeam: number;
  /** 0 = sem limite. Quem passar do limite fica na lista de espera. */
  maxPlayers: number;
  /** Em ordem de confirmação */
  attendees: string[];
  matches: Match[];
  /** Craque do jogo */
  mvp?: string | null;
  /** Avulsos que já pagaram este jogo */
  paid: string[];
  teams: string[][] | null;
  /** Nota pós-jogo (0 a 10) dada pelo organizador; usada quando não há votos da galera (modo sem conta e jogos antigos) */
  ratings: Record<string, number>;
  notes?: string;
  /** Quando o organizador encerrou o jogo (ISO, hora do servidor). Abre a votação por 24 h. */
  closedAt?: string | null;
  /** Soma dos votos da galera por jogador (vem do servidor; nunca mostra quem votou em quem) */
  votes?: Record<string, VoteTotals>;
  /** Quantas pessoas já votaram neste jogo */
  voters?: number;
}

export interface VoteTotals {
  ownSum: number;
  ownN: number;
  oppSum: number;
  oppN: number;
}

export interface Expense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  amount: number;
}

export interface Settings {
  groupName: string;
  /** O clube tem mensalistas? Desligado: todo mundo paga por jogo e a mensalidade some. Sem valor = ligado (clubes antigos). */
  monthlyEnabled?: boolean;
  monthlyFee: number;
  defaultPrice: number;
  defaultPlayersPerTeam: number;
  defaultLocation: string;
  defaultMaxPlayers: number;
  defaultMatchMinutes: number;
  pixKey: string;
  pixName: string;
  pixCity: string;
}

export const POSITIONS: { key: Position; label: string }[] = [
  { key: 'GOL', label: 'Goleiro' },
  { key: 'ZAG', label: 'Defesa' },
  { key: 'MEI', label: 'Meio' },
  { key: 'ATA', label: 'Ataque' },
];

export const SKILLS: { key: keyof Skills; label: string }[] = [
  { key: 'tecnica', label: 'Técnica' },
  { key: 'fisico', label: 'Físico' },
  { key: 'passe', label: 'Passe' },
  { key: 'finalizacao', label: 'Finalização' },
  { key: 'defesa', label: 'Defesa' },
];
