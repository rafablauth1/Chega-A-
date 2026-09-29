import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Avatar, Card, Chip, Empty, Screen, Segmented, text } from '@/components/ui';
import { useAuth, type Profile } from '@/auth';
import { fetchGamesOf } from '@/cloud';
import { fetchPeople } from '@/people';
import { useStore } from '@/store';
import { colors, fonts, positionColors } from '@/theme';
import type { Game, Position } from '@/types';
import { toLocalIso } from '@/utils/format';
import { participantsOf, seasonScores } from '@/utils/scoring';
import { computeStats, confirmedIds } from '@/utils/stats';

type Scope = 'clube' | 'geral';
type Period = 'mes' | 'ano' | 'geral';
type Category = 'pontos' | 'gols' | 'assist' | 'presenca' | 'nota' | 'craque' | 'vitorias';

interface RankPlayer {
  id: string;
  name: string;
  nickname?: string | null;
  photo?: string | null;
  position: Position;
  active: boolean;
}

const CATEGORIES: { key: Category; label: string; unit: string }[] = [
  { key: 'pontos', label: '🎯 Pontuação', unit: 'pts' },
  { key: 'gols', label: '⚽ Artilharia', unit: 'gols' },
  { key: 'assist', label: '🅰️ Assistências', unit: 'assist.' },
  { key: 'presenca', label: '📅 Presença', unit: '' },
  { key: 'nota', label: '⭐ Nota', unit: '' },
  { key: 'craque', label: '🏆 Craque', unit: 'x' },
  { key: 'vitorias', label: '💪 Vitórias', unit: 'V' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

/** Nota e pontuação: quem ainda não foi avaliado aparece no fim, como "Sem avaliação". */
const SHOWS_UNRATED: Category[] = ['pontos', 'nota'];

const rankPlayer = (p: Profile): RankPlayer => ({
  id: p.id,
  name: p.name,
  nickname: p.nickname,
  photo: p.photos?.[0],
  position: p.position,
  active: true,
});

export default function RankingScreen() {
  const { groups } = useAuth();
  const storePlayers = useStore((s) => s.players);
  const storeGames = useStore((s) => s.games);
  const [scope, setScope] = useState<Scope>('clube');
  const [allGames, setAllGames] = useState<Game[] | null>(null);
  const [allPlayers, setAllPlayers] = useState<RankPlayer[] | null>(null);
  const [loadingGeral, setLoadingGeral] = useState(false);
  const [period, setPeriod] = useState<Period>('ano');
  const [cat, setCat] = useState<Category>('pontos');

  const clubIds = useMemo(() => groups.filter((g) => g.kind !== 'avulso').map((g) => g.id), [groups]);

  useEffect(() => {
    if (scope !== 'geral' || allGames !== null || clubIds.length === 0) return;
    setLoadingGeral(true);
    fetchGamesOf(clubIds)
      .then(async (gs) => {
        const ids = [...new Set(gs.flatMap((g) => participantsOf(g)))];
        const profiles = await fetchPeople(ids).catch(() => []);
        setAllGames(gs);
        setAllPlayers(profiles.map(rankPlayer));
      })
      .catch(() => {
        setAllGames([]);
        setAllPlayers([]);
      })
      .finally(() => setLoadingGeral(false));
  }, [scope, clubIds, allGames]);

  const players: RankPlayer[] = scope === 'geral' ? (allPlayers ?? []) : storePlayers;
  const games: Game[] = scope === 'geral' ? (allGames ?? []) : storeGames;

  const rows = useMemo(() => {
    const now = new Date();
    const nowIso = toLocalIso(now);
    const prefix = period === 'mes' ? nowIso.slice(0, 7) : period === 'ano' ? nowIso.slice(0, 4) : '';
    const played = games.filter((g) => g.date <= nowIso && g.date.startsWith(prefix));
    const stats = computeStats(played, nowIso);

    // Pontuação estilo Cartola e nota da galera (utils/scoring)
    const posOf = Object.fromEntries(players.map((p) => [p.id, p.position]));
    const season = seasonScores(played, (id) => posOf[id]);

    return players
      .map((p) => {
        const s = stats[p.id];
        const sc = season[p.id];
        const value: number | null = {
          pontos: sc?.total ?? null,
          gols: s?.goals ?? 0,
          assist: s?.assists ?? 0,
          presenca: played.length ? (played.filter((g) => confirmedIds(g).includes(p.id)).length / played.length) * 100 : 0,
          nota: sc?.nota ?? null,
          craque: s?.mvps ?? 0,
          vitorias: s?.wins ?? 0,
        }[cat];
        const detail =
          cat === 'presenca'
            ? `${s?.games ?? 0}/${played.length} jogos`
            : cat === 'vitorias'
              ? `${s?.wins ?? 0}V ${s?.draws ?? 0}E ${s?.losses ?? 0}D`
              : SHOWS_UNRATED.includes(cat)
                ? sc
                  ? `${sc.games} jogos · média ${sc.average.toFixed(1)}${sc.craques ? ` · 🏆${sc.craques}` : ''}`
                  : 'Sem avaliações ainda'
                : `${s?.games ?? 0} jogos`;
        return { p, value, detail };
      })
      .filter((r) => (r.value === null ? SHOWS_UNRATED.includes(cat) && r.p.active : r.value > 0))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }, [players, games, period, cat]);

  const rated = rows.filter((r) => r.value !== null);

  const format = (v: number | null) =>
    v === null
      ? '—'
      : cat === 'presenca'
        ? `${Math.round(v)}%`
        : cat === 'nota' || cat === 'pontos'
          ? v.toFixed(1)
          : `${v} ${CATEGORIES.find((c) => c.key === cat)!.unit}`;

  const openPlayer = (id: string) => router.push(scope === 'geral' ? `/athlete/${id}` : `/player/${id}`);

  return (
    <Screen>
      {clubIds.length > 1 && (
        <Segmented
          options={[
            { key: 'clube', label: 'Este clube' },
            { key: 'geral', label: 'Todos os clubes' },
          ]}
          value={scope}
          onChange={setScope}
        />
      )}

      <Segmented
        options={[
          { key: 'mes', label: 'Mês' },
          { key: 'ano', label: 'Ano' },
          { key: 'geral', label: 'Geral' },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.label} selected={cat === c.key} onPress={() => setCat(c.key)} />
        ))}
      </ScrollView>

      {scope === 'geral' && loadingGeral && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!(scope === 'geral' && loadingGeral) && rows.length === 0 && (
        <Empty icon="trophy-outline" title="Sem dados ainda" text="Registre partidas e gols e encerre os jogos para a galera avaliar." />
      )}

      {/* Pódio */}
      {rated.length >= 3 && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {[1, 0, 2].map((i) => {
            const r = rated[i];
            const h = [110, 84, 64][i];
            return (
              <View key={r.p.id} style={{ alignItems: 'center', flex: 1 }}>
                <Avatar name={r.p.name} photo={r.p.photo} color={positionColors[r.p.position]} size={i === 0 ? 56 : 46} />
                <Text style={[text.title, { fontSize: 14, marginTop: 4 }]} numberOfLines={1}>
                  {r.p.nickname || r.p.name}
                </Text>
                <Text style={{ color: colors.gold, fontFamily: fonts.display }}>{format(r.value)}</Text>
                <View
                  style={{
                    height: h,
                    width: '100%',
                    marginTop: 6,
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    backgroundColor: i === 0 ? colors.gold + '40' : colors.cardAlt,
                    alignItems: 'center',
                    paddingTop: 8,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{MEDALS[i]}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {rows.map((r, i) => (
        <Card key={r.p.id} onPress={() => openPlayer(r.p.id)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 28, textAlign: 'center', fontSize: i < 3 && r.value !== null ? 20 : 15, color: colors.muted, fontFamily: fonts.display }}>
              {r.value === null ? '–' : i < 3 ? MEDALS[i] : `${i + 1}º`}
            </Text>
            <Avatar name={r.p.name} photo={r.p.photo} size={36} color={positionColors[r.p.position]} />
            <View style={{ flex: 1 }}>
              <Text style={text.title} numberOfLines={1}>
                {r.p.nickname || r.p.name}
              </Text>
              <Text style={text.muted}>{r.detail}</Text>
            </View>
            <Text style={{ color: r.value === null ? colors.muted : colors.primary, fontFamily: fonts.display, fontSize: 16 }}>
              {format(r.value)}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
