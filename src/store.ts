import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Expense, Game, Goal, Player, Settings } from './types';
import { uid } from './utils/format';

export interface Data {
  players: Player[];
  games: Game[];
  expenses: Expense[];
  /** mês "YYYY-MM" -> ids dos mensalistas que pagaram */
  monthly: Record<string, string[]>;
  settings: Settings;
}

interface State extends Data {
  addPlayer: (p: Omit<Player, 'id' | 'createdAt'>) => string;
  updatePlayer: (id: string, p: Partial<Player>) => void;
  removePlayer: (id: string) => void;

  addGame: (g: Omit<Game, 'id' | 'attendees' | 'paid' | 'teams' | 'ratings' | 'matches'>) => string;
  updateGame: (id: string, g: Partial<Game>) => void;
  removeGame: (id: string) => void;
  toggleAttendee: (gameId: string, playerId: string) => void;
  setTeams: (gameId: string, teams: string[][] | null) => void;
  togglePaid: (gameId: string, playerId: string) => void;
  ratePlayer: (gameId: string, playerId: string, value: number) => void;
  setMvp: (gameId: string, playerId: string | null) => void;

  addMatch: (gameId: string, teamA: number, teamB: number, durationMin: number) => string;
  removeMatch: (gameId: string, matchId: string) => void;
  finishMatch: (gameId: string, matchId: string, finished: boolean) => void;
  addGoal: (gameId: string, matchId: string, goal: Omit<Goal, 'id'>) => void;
  removeGoal: (gameId: string, matchId: string, goalId: string) => void;

  toggleMonthly: (month: string, playerId: string) => void;
  addExpense: (e: Omit<Expense, 'id'>) => void;
  removeExpense: (id: string) => void;

  updateSettings: (s: Partial<Settings>) => void;
  replaceAll: (data: Data) => void;
  resetAll: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  groupName: 'Pelada dos Amigos',
  monthlyFee: 80,
  defaultPrice: 20,
  defaultPlayersPerTeam: 6,
  defaultLocation: '',
  defaultMaxPlayers: 0,
  defaultMatchMinutes: 10,
  pixKey: '',
  pixName: '',
  pixCity: '',
};

const EMPTY: Data = { players: [], games: [], expenses: [], monthly: {}, settings: DEFAULT_SETTINGS };

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/** Garante que dados antigos ou importados tenham todos os campos atuais. */
export const normalize = (d: Partial<Data>): Data => ({
  players: d.players ?? [],
  expenses: d.expenses ?? [],
  monthly: d.monthly ?? {},
  settings: { ...DEFAULT_SETTINGS, ...d.settings },
  games: (d.games ?? []).map((g) => ({
    ...g,
    maxPlayers: g.maxPlayers ?? 0,
    matches: g.matches ?? [],
    ratings: g.ratings ?? {},
    paid: g.paid ?? [],
    teams: g.teams ?? null,
  })),
});

export const useStore = create<State>()(
  persist(
    (set) => {
      const patchGame = (id: string, fn: (g: Game) => Partial<Game>) =>
        set((s) => ({ games: s.games.map((g) => (g.id === id ? { ...g, ...fn(g) } : g)) }));

      const patchMatches = (gameId: string, fn: (m: Game['matches']) => Game['matches']) =>
        patchGame(gameId, (g) => ({ matches: fn(g.matches) }));

      return {
        ...EMPTY,

        addPlayer: (p) => {
          const id = uid();
          set((s) => ({ players: [...s.players, { ...p, id, createdAt: new Date().toISOString() }] }));
          return id;
        },
        updatePlayer: (id, p) =>
          set((s) => ({ players: s.players.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        removePlayer: (id) =>
          set((s) => ({
            players: s.players.filter((x) => x.id !== id),
            games: s.games.map((g) => ({
              ...g,
              attendees: g.attendees.filter((a) => a !== id),
              paid: g.paid.filter((a) => a !== id),
              teams: g.teams?.map((t) => t.filter((a) => a !== id)) ?? null,
            })),
          })),

        addGame: (g) => {
          const id = uid();
          set((s) => ({
            games: [...s.games, { ...g, id, attendees: [], paid: [], teams: null, ratings: {}, matches: [] }],
          }));
          return id;
        },
        updateGame: (id, g) => patchGame(id, () => g),
        removeGame: (id) => set((s) => ({ games: s.games.filter((g) => g.id !== id) })),
        toggleAttendee: (gameId, playerId) =>
          patchGame(gameId, (g) => {
            const leaving = g.attendees.includes(playerId);
            return {
              attendees: toggle(g.attendees, playerId),
              paid: leaving ? g.paid.filter((x) => x !== playerId) : g.paid,
              teams: leaving ? g.teams?.map((t) => t.filter((x) => x !== playerId)) ?? null : g.teams,
            };
          }),
        setTeams: (gameId, teams) => patchGame(gameId, () => ({ teams })),
        togglePaid: (gameId, playerId) => patchGame(gameId, (g) => ({ paid: toggle(g.paid, playerId) })),
        ratePlayer: (gameId, playerId, value) =>
          patchGame(gameId, (g) => ({ ratings: { ...g.ratings, [playerId]: value } })),
        setMvp: (gameId, playerId) => patchGame(gameId, () => ({ mvp: playerId })),

        addMatch: (gameId, teamA, teamB, durationMin) => {
          const id = uid();
          patchMatches(gameId, (ms) => [...ms, { id, teamA, teamB, durationMin, goals: [], finished: false }]);
          return id;
        },
        removeMatch: (gameId, matchId) => patchMatches(gameId, (ms) => ms.filter((m) => m.id !== matchId)),
        finishMatch: (gameId, matchId, finished) =>
          patchMatches(gameId, (ms) => ms.map((m) => (m.id === matchId ? { ...m, finished } : m))),
        addGoal: (gameId, matchId, goal) =>
          patchMatches(gameId, (ms) =>
            ms.map((m) => (m.id === matchId ? { ...m, goals: [...m.goals, { ...goal, id: uid() }] } : m)),
          ),
        removeGoal: (gameId, matchId, goalId) =>
          patchMatches(gameId, (ms) =>
            ms.map((m) => (m.id === matchId ? { ...m, goals: m.goals.filter((x) => x.id !== goalId) } : m)),
          ),

        toggleMonthly: (month, playerId) =>
          set((s) => ({ monthly: { ...s.monthly, [month]: toggle(s.monthly[month] ?? [], playerId) } })),
        addExpense: (e) => set((s) => ({ expenses: [...s.expenses, { ...e, id: uid() }] })),
        removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

        updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        replaceAll: (data) => set(normalize(data)),
        resetAll: () => set(EMPTY),
      };
    },
    {
      name: 'vaia-ai-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted) => normalize(persisted as Partial<Data>),
    },
  ),
);

export const exportData = (): Data => {
  const { players, games, expenses, monthly, settings } = useStore.getState();
  return { players, games, expenses, monthly, settings };
};
