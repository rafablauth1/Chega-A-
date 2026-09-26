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
}

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
  /** Data/hora local no formato YYYY-MM-DDTHH:mm */
  date: string;
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
  /** Nota pós-jogo (1 a 5) por jogador */
  ratings: Record<string, number>;
  notes?: string;
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
