import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Game } from '../types';
import { gameEndTime, parseLocal } from './format';
import { confirmedIds } from './stats';

/**
 * Lembretes de jogo, agendados no PRÓPRIO celular (não precisam de servidor nem de Firebase):
 *  - confirmado: "Amanhã tem jogo" (24 h antes) e "Pelada em 2 horas" (2 h antes)
 *  - não confirmado, jogo de um clube meu: "Jogo amanhã, já confirmou?" (24 h antes)
 * A cada mudança nos jogos, tudo é reagendado (cancela os antigos e agenda de novo).
 * A pessoa desliga em Meu perfil → Lembretes de jogo.
 */

const OFF_KEY = 'vaia-ai-reminders-off';
const ASKED_KEY = 'vaia-ai-reminders-asked';
const TAPPED_KEY = 'vaia-ai-reminders-last-tap';
const CHANNEL = 'lembretes';
const MAX = 30; // o Android limita os agendamentos; 30 cobre várias semanas

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function remindersEnabled() {
  return (await AsyncStorage.getItem(OFF_KEY).catch(() => null)) !== '1';
}

export async function setRemindersEnabled(on: boolean) {
  await AsyncStorage.setItem(OFF_KEY, on ? '0' : '1').catch(() => {});
  if (!on) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Pede permissão uma vez (Android 13+ e iPhone perguntam). Devolve se pode notificar. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain || (await AsyncStorage.getItem(ASKED_KEY).catch(() => null))) return false;
  await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

type AnyGame = Game & { groupId: string };

let lastKey = '';

/** Reagenda os lembretes a partir da lista de próximos jogos (de todos os clubes). */
export async function syncReminders(games: AnyGame[], me: string, placeOf: (g: AnyGame) => string) {
  if (Platform.OS === 'web' || !me) return;
  // Só refaz quando algo que importa mudou (data, local, presença)
  const key = games.map((g) => `${g.id}|${g.date}|${g.endTime ?? ''}|${g.location}|${g.attendees.includes(me) ? 1 : 0}`).join(';');
  if (key === lastKey) return;
  lastKey = key;
  try {
    if (!(await remindersEnabled())) return;
    if (!games.length) return void (await Notifications.cancelAllScheduledNotificationsAsync());
    if (!(await ensurePermission())) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Lembretes de jogo',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FF7A1A',
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = Date.now();
    const plans: { at: number; title: string; body: string; g: AnyGame }[] = [];
    for (const g of games) {
      const start = parseLocal(g.date).getTime();
      const hhmm = `${g.date.slice(11, 16)}–${gameEndTime(g)}`;
      const where = placeOf(g);
      const count = confirmedIds(g).length;
      const going = g.attendees.includes(me);
      if (going) {
        plans.push({ at: start - 24 * 3600_000, title: 'Amanhã tem jogo ⚽', body: `${hhmm}${where ? ` · ${where}` : ''} · ${count} confirmados`, g });
        plans.push({ at: start - 2 * 3600_000, title: 'Pelada daqui a 2 horas', body: `${hhmm}${where ? ` · ${where}` : ''}. Bora!`, g });
      } else {
        plans.push({ at: start - 24 * 3600_000, title: 'Jogo amanhã: você vai?', body: `${hhmm}${where ? ` · ${where}` : ''} · toque para confirmar presença`, g });
      }
    }
    const due = plans.filter((p) => p.at > now + 60_000).sort((a, b) => a.at - b.at).slice(0, MAX);
    for (const p of due) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { gameId: p.g.id, groupId: p.g.groupId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), channelId: CHANNEL },
      });
    }
  } catch {
    lastKey = ''; // tenta de novo na próxima vez
  }
}

/** Tocou no lembrete: abre o jogo (inclusive com o app fechado). */
export function listenReminderTaps(open: (gameId: string, groupId: string) => void) {
  const handle = async (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    // O "último toque" continua disponível depois; não reabre o mesmo jogo toda vez que o app abre
    const id = r.notification.request.identifier;
    if ((await AsyncStorage.getItem(TAPPED_KEY).catch(() => null)) === id) return;
    await AsyncStorage.setItem(TAPPED_KEY, id).catch(() => {});
    const d = r.notification.request.content.data as { gameId?: string; groupId?: string } | undefined;
    if (d?.gameId && d.groupId) open(d.gameId, d.groupId);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
