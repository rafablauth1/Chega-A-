import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, Fab, Group, Row, Screen, SectionTitle, Tag, text } from '@/components/ui';
import { useCanManage } from '@/auth';
import { isCloudEnabled } from '@/lib/supabase';
import { useStore } from '@/store';
import { colors, fonts } from '@/theme';
import type { Game, Player } from '@/types';
import { buildDemo } from '@/utils/demo';
import { MONTHS_SHORT, formatGameDate, gameEndTime, money, parseLocal, relativeDay, toLocalIso } from '@/utils/format';
import { matchScore, confirmedIds, waitlistIds } from '@/utils/stats';

/** Mesma hora e dia da semana, na próxima data futura. */
const nextWeekly = (iso: string) => {
  const d = parseLocal(iso);
  const now = new Date();
  do d.setDate(d.getDate() + 7);
  while (d < now);
  return toLocalIso(d);
};

export default function GamesScreen() {
  const games = useStore((s) => s.games);
  const players = useStore((s) => s.players);
  const groupName = useStore((s) => s.settings.groupName);
  const replaceAll = useStore((s) => s.replaceAll);
  const addGame = useStore((s) => s.addGame);
  const canManage = useCanManage();

  const repeatGame = (g: Game) => {
    const id = addGame({
      date: nextWeekly(g.date),
      location: g.location,
      pricePerPlayer: g.pricePerPlayer,
      playersPerTeam: g.playersPerTeam,
      maxPlayers: g.maxPlayers,
      notes: g.notes,
    });
    router.push(`/game/${id}`);
  };

  const now = toLocalIso(new Date(Date.now() - 3 * 60 * 60 * 1000)); // jogo em andamento conta como próximo por 3h
  const upcoming = games.filter((g) => g.date >= now).sort((a, b) => a.date.localeCompare(b.date));
  const past = games.filter((g) => g.date < now).sort((a, b) => b.date.localeCompare(a.date));
  const [next, ...later] = upcoming;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={styles.group}>{groupName}</Text>

        {games.length === 0 && (
          <>
            <Empty
              icon="football-outline"
              title="Bora marcar a primeira?"
              text={
                !canManage
                  ? 'Quando o organizador marcar o próximo jogo, ele aparece aqui para você confirmar presença.'
                  : players.length === 0
                  ? 'Cadastre a galera na aba Jogadores e depois marque o jogo no botão laranja.'
                  : 'Toque em "Marcar jogo" para abrir a lista de presença.'
              }
            />
            {players.length === 0 && !isCloudEnabled && (
              <Button title="Ver com 20 jogadores de exemplo" icon="flask-outline" variant="secondary" onPress={() => replaceAll(buildDemo())} />
            )}
          </>
        )}

        {next && <NextGame game={next} players={players} />}

        {canManage && !next && past.length > 0 && (
          <View style={styles.repeat}>
            <Text style={styles.repeatTitle}>Sem jogo marcado</Text>
            <Text style={[text.muted, { fontSize: 15, marginBottom: 14 }]}>
              Repetir o último{past[0].location ? ` na ${past[0].location}` : ''}: {formatGameDate(nextWeekly(past[0].date))}.
            </Text>
            <Button title="Marcar próximo jogo" icon="calendar" onPress={() => repeatGame(past[0])} />
          </View>
        )}

        {later.length > 0 && (
          <>
            <SectionTitle>Depois</SectionTitle>
            <Group>
              {later.map((g) => (
                <GameRow key={g.id} game={g} players={players} />
              ))}
            </Group>
          </>
        )}

        {past.length > 0 && (
          <>
            <SectionTitle>Já rolou</SectionTitle>
            <Group>
              {past.map((g) => (
                <GameRow key={g.id} game={g} players={players} />
              ))}
            </Group>
          </>
        )}
      </Screen>
      {canManage && <Fab onPress={() => router.push('/game-form/new')} label="Marcar jogo" icon="add" />}
    </View>
  );
}

/** Destaque do próximo jogo: dia grande, horário e as vagas desenhadas como camisas. */
function NextGame({ game, players }: { game: Game; players: Player[] }) {
  const d = parseLocal(game.date);
  const confirmed = confirmedIds(game);
  const waiting = waitlistIds(game).length;
  const slots = game.maxPlayers || Math.max(confirmed.length, game.playersPerTeam * 2);
  const open = game.maxPlayers ? game.maxPlayers - confirmed.length : null;
  const keepers = confirmed.filter((id) => players.find((p) => p.id === id)?.position === 'GOL').length;
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <Pressable onPress={() => router.push(`/game/${game.id}`)} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.9 }]}>
      {/* marcação do círculo central, como linha de cal */}
      <View style={styles.heroCircle} />
      <View style={styles.heroLine} />

      <Text style={styles.heroDay}>{relativeDay(game.date)}</Text>
      <Text style={styles.heroTime}>{hh}</Text>
      <Text style={[text.muted, { fontSize: 15, marginBottom: 2 }]}>
        até {gameEndTime(game)}
        {game.matchMinutes ? ` · partidas de ${game.matchMinutes} min` : ''}
      </Text>
      {!!game.location && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <Ionicons name="location" size={14} color={colors.muted} />
          <Text style={[text.muted, { fontSize: 15 }]}>{game.location}</Text>
        </View>
      )}

      <View style={styles.shirts}>
        {Array.from({ length: slots }).map((_, i) => (
          <Ionicons key={i} name={i < confirmed.length ? 'shirt' : 'shirt-outline'} size={17} color={i < confirmed.length ? colors.chalk : colors.border} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Text style={styles.heroCount}>{confirmed.length}</Text>
        <Text style={[text.body, { color: colors.muted }]}>
          {game.maxPlayers ? `de ${game.maxPlayers} confirmados` : 'confirmados'}
          {keepers ? `, ${keepers} ${keepers === 1 ? 'goleiro' : 'goleiros'}` : ', sem goleiro'}
        </Text>
      </View>
      {open !== null && open > 0 && <Text style={[text.body, { color: colors.primary, marginTop: 2 }]}>Faltam {open} para fechar</Text>}
      {waiting > 0 && <Text style={[text.body, { color: colors.warning, marginTop: 2 }]}>{waiting} na lista de espera</Text>}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button title="Abrir lista" icon="list" onPress={() => router.push(`/game/${game.id}`)} style={{ flex: 1 }} />
        <Button
          title={game.teams?.length ? 'Ver times' : 'Times'}
          icon="shirt-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id, tab: 'times' } })}
          style={{ flex: 1 }}
        />
      </View>
    </Pressable>
  );
}

function GameRow({ game, players }: { game: Game; players: Player[] }) {
  const d = parseLocal(game.date);
  const confirmed = confirmedIds(game);
  const unpaid = confirmed.filter((id) => players.find((p) => p.id === id)?.type === 'avulso' && !game.paid.includes(id)).length;
  const goals = game.matches.reduce((s, m) => s + matchScore(m)[0] + matchScore(m)[1], 0);
  const detail = [
    `${confirmed.length} jogadores`,
    game.matches.length ? `${game.matches.length} partidas, ${goals} gols` : null,
    game.matches.length ? null : money(game.pricePerPlayer),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Row onPress={() => router.push(`/game/${game.id}`)}>
      <View style={styles.date}>
        <Text style={styles.dateDay}>{d.getDate()}</Text>
        <Text style={styles.dateMonth}>{MONTHS_SHORT[d.getMonth()]}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.title} numberOfLines={1}>
          {game.location || 'Pelada'}
        </Text>
        <Text style={text.muted} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {unpaid > 0 && <Tag label={`${unpaid} a pagar`} color={colors.warning} />}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Row>
  );
}

const styles = StyleSheet.create({
  group: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 15, marginBottom: 12 },
  hero: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroCircle: {
    position: 'absolute',
    right: -70,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: colors.chalk + '14',
  },
  heroLine: { position: 'absolute', right: 39, top: 0, bottom: 0, width: 2, backgroundColor: colors.chalk + '14' },
  heroDay: { color: colors.primary, fontFamily: fonts.bold, fontSize: 17 },
  heroTime: { color: colors.chalk, fontFamily: fonts.displayBlack, fontSize: 76, lineHeight: 80, letterSpacing: -1 },
  shirts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 18, marginBottom: 10 },
  heroCount: { color: colors.chalk, fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  repeat: { backgroundColor: colors.card, borderRadius: 22, padding: 20, marginBottom: 8 },
  repeatTitle: { color: colors.chalk, fontFamily: fonts.display, fontSize: 34, marginBottom: 4 },
  date: { width: 42, alignItems: 'center' },
  dateDay: { color: colors.chalk, fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  dateMonth: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 },
});
