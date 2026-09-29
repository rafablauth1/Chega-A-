import type { GroupSummary } from './auth';
import { chatError, sendMessage } from './chat';
import { probeGameColumns } from './cloud';
import { supabase } from './lib/supabase';
import { choose, notify } from './utils/confirm';
import { formatShortDate, uid } from './utils/format';

/**
 * Clubes e jogos avulsos (migração 013).
 *  - Clube: a pelada fixa (membros, caixa e, se quiser, mensalistas).
 *  - Jogo avulso: um jogo sem clube. Por baixo é um grupo "avulso" com um jogo só, então presença,
 *    times, placar e avaliação funcionam igual. Dá para publicar no Bora e depois virar clube.
 */

export function clubError(message = '') {
  if (/kind|column .* does not exist|schema cache/i.test(message)) return 'O servidor ainda não tem clubes e jogos avulsos. Rode a migração 013 no Supabase.';
  if (/invalid code|not found/i.test(message)) return 'Código não encontrado. Confira as 6 letras.';
  if (/adults only/i.test(message)) return 'O Bora é para maiores de 18 anos. Coloque sua data de nascimento no perfil.';
  if (/not joinable|already happened/i.test(message)) return 'Essa vaga já fechou ou o jogo já aconteceu.';
  if (/rate limit/i.test(message)) return 'Muitas ações seguidas. Espere um pouco e tente de novo.';
  if (/only club admins/i.test(message)) return 'Só o dono ou um admin do clube publica o jogo no Bora.';
  if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Não deu certo. Tente de novo.';
}

export async function createClub(input: { name: string; monthlyEnabled: boolean; monthlyFee?: number }) {
  const settings = { monthlyEnabled: input.monthlyEnabled, ...(input.monthlyFee ? { monthlyFee: input.monthlyFee } : {}) };
  // Tenta já com "kind"; servidor antigo (sem 013) cria como antes
  let res = await supabase.from('groups').insert({ name: input.name.trim(), kind: 'clube', settings }).select('id').single();
  if (res.error && /kind/i.test(res.error.message)) res = await supabase.from('groups').insert({ name: input.name.trim(), settings }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id as string;
}

export interface SingleGameInput {
  date: string; // YYYY-MM-DDTHH:mm
  endTime: string;
  matchMinutes: number;
  location: string;
  price: number;
  playersPerTeam: number;
  maxPlayers: number;
  notes: string;
  /** Publicar no Bora (vaga aberta para quem está perto) */
  publish: boolean;
  me: string;
  region?: { neighborhood?: string | null; city?: string | null; lat?: number | null; lng?: number | null };
}

/** Cria o jogo avulso. Devolve o grupo, o jogo e se a publicação no Bora deu certo. */
export async function createSingleGame(input: SingleGameInput) {
  const name = `Jogo ${formatShortDate(input.date)}${input.location ? ` · ${input.location}` : ''}`.slice(0, 60);
  const g = await supabase
    .from('groups')
    .insert({ name, kind: 'avulso', settings: { monthlyEnabled: false, defaultPrice: input.price } })
    .select('id')
    .single();
  if (g.error) throw g.error;
  const groupId = g.data.id as string;

  const cols = await probeGameColumns();
  const gameId = uid();
  const game = await supabase.from('games').insert({
    id: gameId,
    group_id: groupId,
    date: input.date,
    location: input.location,
    price_per_player: input.price,
    players_per_team: input.playersPerTeam,
    max_players: input.maxPlayers,
    teams: null,
    matches: [],
    paid: [],
    ratings: {},
    notes: input.notes || null,
    ...(cols?.court ? { end_time: input.endTime, match_minutes: input.matchMinutes } : {}),
  });
  if (game.error) throw game.error;

  // Quem marcou já está confirmado
  await supabase.from('attendance').insert({ game_id: gameId, group_id: groupId, player_id: input.me });

  let published = false;
  let publishError: string | null = null;
  if (input.publish) {
    if (input.region?.lat == null) {
      publishError = 'Para aparecer no Bora, ative sua região no perfil (Editar perfil → Usar minha localização).';
    } else {
      const open = input.maxPlayers ? Math.max(1, input.maxPlayers - 1) : Math.max(1, input.playersPerTeam * 2 - 1);
      const call = await supabase.from('open_calls').insert({
        group_id: groupId,
        game_id: gameId,
        title: `Jogo avulso${input.location ? ` · ${input.location}` : ''}`.slice(0, 80),
        date: input.date,
        location: input.location.slice(0, 120),
        slots: Math.min(30, open),
        price: input.price,
        notes: input.notes ? input.notes.slice(0, 300) : null,
        neighborhood: input.region.neighborhood ?? null,
        city: input.region.city ?? null,
        lat_approx: input.region.lat,
        lng_approx: input.region.lng,
      });
      if (call.error) publishError = clubError(call.error.message);
      else published = true;
    }
  }
  return { groupId, gameId, published, publishError };
}

/** Entra num clube ou jogo avulso pelo código. Para jogo avulso, devolve também o jogo (para abrir direto). */
export async function joinByCode(code: string): Promise<{ groupId: string; kind: 'clube' | 'avulso'; gameId: string | null }> {
  const { data, error } = await supabase.rpc('join_group', { code: code.trim().toUpperCase() });
  if (error) throw error;
  const groupId = data as string;
  const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
  const kind = (g as any)?.kind === 'avulso' ? 'avulso' : 'clube';
  let gameId: string | null = null;
  if (kind === 'avulso') {
    const { data: games } = await supabase.from('games').select('id').eq('group_id', groupId).order('date').limit(1);
    gameId = games?.[0]?.id ?? null;
  }
  return { groupId, kind, gameId };
}

/** Entrar no jogo que está no Bora (sem código). */
export async function joinCallGame(callId: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_call_game', { cid: callId });
  if (error) throw error;
  return data as string;
}

/** O jogo avulso deu certo? Vira clube, com todo mundo dentro. */
export async function convertToClub(groupId: string, name: string) {
  const { error } = await supabase.from('groups').update({ kind: 'clube', name: name.trim() }).eq('id', groupId);
  if (error) throw error;
}

/**
 * Convida alguém (achado por parceiro, vaga ou perfil) pra um clube/jogo seu: manda o código
 * pelo chat do próprio app. Se a pessoa estiver em mais de um clube seu, pergunta qual.
 */
export function inviteToClub(groups: GroupSummary[], target: { id: string; name: string }) {
  if (groups.length === 0) return notify('Sem clube', 'Você ainda não tem um clube ou jogo pra convidar alguém.');

  const send = (g: GroupSummary) =>
    sendMessage(target.id, `Bora pro ${g.name}! ⚽ Baixe o Vaia Aí e entre com o código: ${g.invite_code}`)
      .then(() => notify('Convite enviado!', `Mandamos uma mensagem pra ${target.name} com o código do ${g.name}.`))
      .catch((e: any) => notify('Não deu certo', chatError(e?.message)));

  if (groups.length === 1) return send(groups[0]);
  choose(
    `Convidar ${target.name} para...`,
    groups.map((g) => ({ text: g.kind === 'avulso' ? `${g.name} (jogo avulso)` : g.name, onPress: () => send(g) })),
  );
}
