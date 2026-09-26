import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { DEFAULT_SETTINGS, exportData, normalize, scaleOldRatings, useStore, type Data } from './store';
import type { Game, Player } from './types';
import { notify } from './utils/confirm';

/**
 * Sincroniza o store local com o grupo ativo no Supabase.
 * As telas continuam usando o zustand; cada mudança local vira uma escrita na nuvem
 * e mudanças de outros celulares chegam por tempo real e recarregam o grupo.
 */

const EMPTY: Data = { players: [], games: [], expenses: [], monthly: {}, settings: DEFAULT_SETTINGS };
const LOCAL_BACKUP_KEY = 'vaia-ai-local-backup';
/** Qual grupo está guardado no store persistido (cache para abrir rápido e sem internet) */
const CACHE_KEY = 'vaia-ai-cache-group';

let groupId: string | null = null;
let applying = false;
let channel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
/** Escritas em fila, na ordem em que aconteceram (ex.: criar o jogo antes da presença) */
let queue: Promise<unknown> = Promise.resolve();
/** Resultado do último lote de escritas (true = tudo salvo na nuvem) */
let lastPush: Promise<boolean> = Promise.resolve(true);

const apply = (data: Data) => {
  applying = true;
  try {
    useStore.setState(data);
  } finally {
    applying = false;
  }
};

/* ------------------------------ Leitura ------------------------------ */

const toGame = (g: any, attendees: string[]): Game => ({
  id: g.id,
  date: g.date,
  location: g.location,
  pricePerPlayer: Number(g.price_per_player),
  playersPerTeam: g.players_per_team,
  maxPlayers: g.max_players,
  attendees,
  matches: g.matches ?? [],
  mvp: g.mvp,
  paid: g.paid ?? [],
  teams: g.teams,
  ratings: g.ratings ?? {},
  notes: g.notes ?? undefined,
});

const attendeesByGame = (rows: { game_id: string; player_id: string }[] | null) => {
  const map: Record<string, string[]> = {};
  for (const a of rows ?? []) (map[a.game_id] ??= []).push(a.player_id);
  return map;
};

/** Jogos de todos os grupos do usuário, para as estatísticas do perfil de atleta. */
export async function fetchGamesOf(groupIds: string[]): Promise<(Game & { groupId: string })[]> {
  if (!groupIds.length) return [];
  const [games, attendance] = await Promise.all([
    supabase.from('games').select('*').in('group_id', groupIds),
    supabase.from('attendance').select('game_id, player_id').in('group_id', groupIds).order('created_at'),
  ]);
  if (games.error) throw games.error;
  if (attendance.error) throw attendance.error;
  const byGame = attendeesByGame(attendance.data);
  return (games.data ?? []).map((g) => ({ ...toGame(g, byGame[g.id] ?? []), groupId: g.group_id }));
}

async function fetchGroup(gid: string): Promise<Data> {
  const [group, members, guests, games, attendance, expenses, monthly] = await Promise.all([
    supabase.from('groups').select('name, settings').eq('id', gid).single(),
    supabase.from('group_members').select('user_id, type, active, skills, joined_at').eq('group_id', gid),
    supabase.from('guests').select('*').eq('group_id', gid),
    supabase.from('games').select('*').eq('group_id', gid),
    supabase.from('attendance').select('game_id, player_id').eq('group_id', gid).order('created_at'),
    supabase.from('expenses').select('id, date, description, amount').eq('group_id', gid),
    supabase.from('monthly_payments').select('month, player_id').eq('group_id', gid),
  ]);
  const failed = [group, members, guests, games, attendance, expenses, monthly].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  const profileOf = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const players: Player[] = [
    ...(members.data ?? []).map((m) => {
      const p = profileOf[m.user_id] ?? {};
      return {
        id: m.user_id,
        name: p.name || 'Jogador',
        nickname: p.nickname ?? undefined,
        phone: p.phone ?? undefined,
        position: p.position ?? 'MEI',
        type: m.type,
        skills: m.skills ?? p.skills,
        active: m.active,
        createdAt: m.joined_at,
        account: true,
        photo: p.photos?.[0],
      } as Player;
    }),
    ...(guests.data ?? []).map(
      (g): Player => ({
        id: g.id,
        name: g.name,
        nickname: g.nickname ?? undefined,
        phone: g.phone ?? undefined,
        position: g.position,
        type: g.type,
        skills: g.skills,
        active: g.active,
        createdAt: g.created_at,
      }),
    ),
  ];

  const byGame = attendeesByGame(attendance.data);

  const monthlyMap: Record<string, string[]> = {};
  for (const m of monthly.data ?? []) (monthlyMap[m.month] ??= []).push(m.player_id);

  return {
    players,
    games: (games.data ?? []).map((g) => toGame(g, byGame[g.id] ?? [])),
    expenses: (expenses.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })),
    monthly: monthlyMap,
    settings: { ...DEFAULT_SETTINGS, ...(group.data?.settings ?? {}), groupName: group.data?.name ?? '' },
  };
}

async function reload() {
  const gid = groupId;
  if (!gid) return;
  await queue; // espera as escritas pendentes para não mostrar dado velho
  try {
    const data = await fetchGroup(gid);
    if (gid === groupId) apply(data);
  } catch {
    // sem internet: fica com o que já está na tela
  }
}

const scheduleReload = () => {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reload, 400);
};

/* ------------------------------ Escrita ------------------------------ */

const gameRow = (g: Game, gid: string) => ({
  id: g.id,
  group_id: gid,
  date: g.date,
  location: g.location,
  price_per_player: g.pricePerPlayer,
  players_per_team: g.playersPerTeam,
  max_players: g.maxPlayers,
  teams: g.teams,
  matches: g.matches,
  mvp: g.mvp ?? null,
  paid: g.paid,
  ratings: g.ratings,
  notes: g.notes ?? null,
});

const guestRow = (p: Player, gid: string) => ({
  id: p.id,
  group_id: gid,
  name: p.name,
  nickname: p.nickname || null,
  phone: p.phone || null,
  position: p.position,
  type: p.type,
  skills: p.skills,
  active: p.active,
});

type Op = PromiseLike<{ error: { message: string } | null }>;

function push(ops: (() => Op)[]) {
  if (!ops.length) return;
  const fail = (denied: boolean) => {
    notify('Não foi possível salvar', denied ? 'Só os admins do grupo podem mudar isso.' : 'Verifique sua internet e tente de novo.');
    scheduleReload(); // volta a tela para o que está na nuvem
  };
  lastPush = queue.then(async () => {
    try {
      for (const op of ops) {
        const { error } = await op();
        if (error) {
          fail(/row-level security|permission/i.test(error.message));
          return false;
        }
      }
      return true;
    } catch {
      fail(false); // sem conexão; a fila segue funcionando para as próximas mudanças
      return false;
    }
  });
  queue = lastPush;
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diff(s: Data, prev: Data) {
  const gid = groupId!;
  const ops: (() => Op)[] = [];
  // Exclusões vão por último (ex.: apagar o jogo leva a presença junto)
  const removals: (() => Op)[] = [];

  // Configurações do grupo
  if (s.settings !== prev.settings) {
    const { groupName, ...settings } = s.settings;
    ops.push(() => supabase.from('groups').update({ name: groupName, settings }).eq('id', gid));
  }

  // Jogadores: membros atualizam o vínculo com o grupo; convidados, a tabela de convidados
  if (s.players !== prev.players) {
    const before = byId(prev.players);
    const after = byId(s.players);
    const guests: ReturnType<typeof guestRow>[] = [];
    for (const p of s.players) {
      const old = before.get(p.id);
      if (old === p) continue;
      if (p.account) {
        // Só grava a nota se o admin mudou; senão continua valendo a autoavaliação do perfil
        const patch = { type: p.type, active: p.active, ...(old && same(old.skills, p.skills) ? {} : { skills: p.skills }) };
        ops.push(() => supabase.from('group_members').update(patch).eq('group_id', gid).eq('user_id', p.id));
      } else {
        guests.push(guestRow(p, gid));
      }
    }
    if (guests.length) ops.push(() => supabase.from('guests').upsert(guests));

    const gone = prev.players.filter((p) => !after.has(p.id));
    const goneGuests = gone.filter((p) => !p.account).map((p) => p.id);
    if (goneGuests.length) removals.push(() => supabase.from('guests').delete().in('id', goneGuests));
    for (const p of gone.filter((x) => x.account)) {
      removals.push(() => supabase.from('group_members').delete().eq('group_id', gid).eq('user_id', p.id));
    }
  }

  // Jogos e presença
  if (s.games !== prev.games) {
    const before = byId(prev.games);
    const after = byId(s.games);
    const rows: ReturnType<typeof gameRow>[] = [];
    const joins: { game_id: string; group_id: string; player_id: string; created_at?: string }[] = [];
    for (const g of s.games) {
      const old = before.get(g.id);
      if (old === g) continue;
      // Jogador comum só mexe na presença; só grava o jogo se algo além dela mudou
      const row = gameRow(g, gid);
      if (!old || !same(gameRow(old, gid), row)) rows.push(row);
      const had = new Set(old?.attendees ?? []);
      const has = new Set(g.attendees);
      for (const pid of g.attendees) if (!had.has(pid)) joins.push({ game_id: g.id, group_id: gid, player_id: pid });
      const left = [...had].filter((pid) => !has.has(pid));
      if (left.length) ops.push(() => supabase.from('attendance').delete().eq('game_id', g.id).in('player_id', left));
    }
    // Várias presenças de uma vez: a hora marca a ordem de chegada (senão todas teriam o mesmo horário)
    if (joins.length > 1) {
      const t = Date.now();
      joins.forEach((j, i) => (j.created_at = new Date(t + i).toISOString()));
    }
    if (rows.length) ops.push(() => supabase.from('games').upsert(rows));
    if (joins.length) {
      ops.push(() => supabase.from('attendance').upsert(joins, { onConflict: 'game_id,player_id', ignoreDuplicates: true }));
    }
    const goneGames = prev.games.filter((g) => !after.has(g.id)).map((g) => g.id);
    if (goneGames.length) removals.push(() => supabase.from('games').delete().in('id', goneGames));
  }

  // Caixa
  if (s.expenses !== prev.expenses) {
    const before = byId(prev.expenses);
    const after = byId(s.expenses);
    const added = s.expenses.filter((e) => !before.has(e.id)).map((e) => ({ ...e, group_id: gid }));
    if (added.length) ops.push(() => supabase.from('expenses').insert(added));
    const gone = prev.expenses.filter((e) => !after.has(e.id)).map((e) => e.id);
    if (gone.length) removals.push(() => supabase.from('expenses').delete().in('id', gone));
  }
  if (s.monthly !== prev.monthly) {
    const paid: { group_id: string; month: string; player_id: string }[] = [];
    for (const month of new Set([...Object.keys(s.monthly), ...Object.keys(prev.monthly)])) {
      const had = new Set(prev.monthly[month] ?? []);
      const has = new Set(s.monthly[month] ?? []);
      for (const pid of has) if (!had.has(pid)) paid.push({ group_id: gid, month, player_id: pid });
      const undone = [...had].filter((pid) => !has.has(pid));
      if (undone.length) {
        removals.push(() => supabase.from('monthly_payments').delete().eq('group_id', gid).eq('month', month).in('player_id', undone));
      }
    }
    if (paid.length) ops.push(() => supabase.from('monthly_payments').upsert(paid, { ignoreDuplicates: true }));
  }

  push([...ops, ...removals]);
}

useStore.subscribe((s, prev) => {
  if (applying || !groupId) return;
  diff(s, prev);
});

/* ------------------------------ Controle ------------------------------ */

/** Guarda (uma vez) os dados que existiam só no celular antes de usar a nuvem. */
async function backupLocalData() {
  if (await AsyncStorage.getItem(LOCAL_BACKUP_KEY)) return;
  const data = exportData();
  if (data.players.length || data.games.length) {
    await AsyncStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({ ...data, ratingScale: 10 }));
  }
}

export async function getLocalBackup(): Promise<Data | null> {
  const raw = await AsyncStorage.getItem(LOCAL_BACKUP_KEY).catch(() => null);
  if (!raw) return null;
  const data = JSON.parse(raw);
  // Backups feitos antes da nota 0–10 guardam as notas de 1 a 5
  return normalize(data.ratingScale === 10 ? data : scaleOldRatings(data));
}

/**
 * Junta no grupo ativo os dados que existiam só neste celular. Os jogadores entram como convidados
 * (depois o admin pode vincular cada um à conta do amigo). A sincronização normal envia tudo.
 */
export async function importLocalBackup(backup: Data) {
  const s = useStore.getState();
  const known = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const players = known(s.players);
  const games = known(s.games);
  const expenses = known(s.expenses);
  const monthly = { ...s.monthly };
  for (const [month, ids] of Object.entries(backup.monthly)) monthly[month] = [...new Set([...(monthly[month] ?? []), ...ids])];
  useStore.setState({
    players: [...s.players, ...backup.players.filter((p) => !players.has(p.id)).map((p) => ({ ...p, account: false }))],
    games: [...s.games, ...backup.games.filter((g) => !games.has(g.id))],
    expenses: [...s.expenses, ...backup.expenses.filter((e) => !expenses.has(e.id))],
    monthly,
    settings: { ...s.settings, ...backup.settings, groupName: s.settings.groupName },
  });
  // Só apaga o backup do celular se tudo chegou na nuvem
  const ok = await lastPush;
  if (ok) await AsyncStorage.removeItem(LOCAL_BACKUP_KEY);
  return ok;
}

/** Troca o grupo sincronizado (null = nenhum grupo, tela vazia). */
export async function openGroup(gid: string | null) {
  if (gid === groupId) return;
  if (channel) supabase.removeChannel(channel);
  channel = null;
  groupId = null;

  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    // Primeira vez na nuvem: o que está no store são dados só deste celular
    if (cached === null) await backupLocalData();
    // O cache é de outro grupo: limpa para não misturar
    if (cached !== gid) apply(EMPTY);
    if (gid) await AsyncStorage.setItem(CACHE_KEY, gid);
    else await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    apply(EMPTY);
  }

  groupId = gid;
  if (!gid) return;

  channel = supabase.channel(`group-${gid}`);
  const tables = ['games', 'attendance', 'guests', 'group_members', 'expenses', 'monthly_payments'];
  for (const table of tables) {
    for (const event of ['INSERT', 'UPDATE'] as const) {
      channel.on('postgres_changes', { event, schema: 'public', table, filter: `group_id=eq.${gid}` }, scheduleReload);
    }
    // O Supabase não filtra DELETE por coluna: escuta todos e recarrega
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, scheduleReload);
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${gid}` }, scheduleReload);
  channel.subscribe();
  await reload();
}

export const reloadGroup = reload;
