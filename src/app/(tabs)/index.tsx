import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Empty, Fab, Screen, SectionTitle, Tag, text, type IconName } from '@/components/ui';
import { useStore } from '@/store';
import { buildDemo } from '@/utils/demo';
import { confirmedIds, waitlistIds } from '@/utils/stats';
import { colors } from '@/theme';
import type { Game, Player } from '@/types';
import { formatGameDate, money, toLocalIso } from '@/utils/format';

export default function GamesScreen() {
  const games = useStore((s) => s.games);
  const players = useStore((s) => s.players);
  const groupName = useStore((s) => s.settings.groupName);
  const replaceAll = useStore((s) => s.replaceAll);

  const now = toLocalIso(new Date(Date.now() - 3 * 60 * 60 * 1000)); // jogo "em andamento" conta como próximo por 3h
  const upcoming = games.filter((g) => g.date >= now).sort((a, b) => a.date.localeCompare(b.date));
  const past = games.filter((g) => g.date < now).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>
          {groupName.toUpperCase()}
        </Text>

        {games.length === 0 && (
          <Empty
            icon="football-outline"
            title="Nenhum jogo marcado"
            text={
              players.length === 0
                ? 'Comece cadastrando a galera na aba Jogadores, depois marque o primeiro jogo no botão +.'
                : 'Toque no + para marcar o próximo jogo.'
            }
          />
        )}
        {players.length === 0 && (
          <Button
            title="Ver com 20 jogadores de exemplo"
            icon="flask-outline"
            variant="secondary"
            onPress={() => replaceAll(buildDemo())}
          />
        )}

        {upcoming.length > 0 && <SectionTitle>Próximos</SectionTitle>}
        {upcoming.map((g, i) => (
          <GameCard key={g.id} game={g} players={players} highlight={i === 0} />
        ))}

        {past.length > 0 && <SectionTitle>Anteriores</SectionTitle>}
        {past.map((g) => (
          <GameCard key={g.id} game={g} players={players} />
        ))}
      </Screen>
      <Fab onPress={() => router.push('/game-form/new')} />
    </View>
  );
}

function GameCard({ game, players, highlight }: { game: Game; players: Player[]; highlight?: boolean }) {
  const confirmed = confirmedIds(game);
  const waiting = waitlistIds(game).length;
  const avulsos = confirmed.filter((id) => players.find((p) => p.id === id)?.type === 'avulso');
  const unpaid = avulsos.filter((id) => !game.paid.includes(id)).length;

  return (
    <Card
      onPress={() => router.push(`/game/${game.id}`)}
      style={highlight && { borderColor: colors.primary, backgroundColor: colors.cardAlt }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={text.title}>{formatGameDate(game.date)}</Text>
          {!!game.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text style={text.muted}>{game.location}</Text>
            </View>
          )}
        </View>
        {highlight && <Tag label="PRÓXIMO" color={colors.primary} />}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <Info
          icon="people-outline"
          label={game.maxPlayers ? `${confirmed.length}/${game.maxPlayers} confirmados` : `${confirmed.length} confirmados`}
        />
        {waiting > 0 && <Info icon="hourglass-outline" label={`${waiting} na espera`} color={colors.warning} />}
        <Info icon="shirt-outline" label={game.teams?.length ? `${game.teams.length} times` : 'Sem times'} />
        <Info icon="cash-outline" label={money(game.pricePerPlayer)} />
        {unpaid > 0 && <Info icon="alert-circle-outline" label={`${unpaid} a pagar`} color={colors.warning} />}
      </View>
    </Card>
  );
}

function Info({ icon, label, color = colors.muted }: { icon: IconName; label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
