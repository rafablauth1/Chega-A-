import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Card, Chip, Empty, Screen, Segmented, text } from '@/components/ui';
import { useStore } from '@/store';
import { colors, fonts, positionColors } from '@/theme';
import { toLocalIso } from '@/utils/format';
import { displayName } from '@/utils/names';
import { seasonScores } from '@/utils/scoring';
import { computeStats, confirmedIds } from '@/utils/stats';

type Period = 'mes' | 'ano' | 'geral';
type Category = 'pontos' | 'gols' | 'assist' | 'presenca' | 'nota' | 'craque' | 'vitorias';

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

export default function RankingScreen() {
  const players = useStore((s) => s.players);
  const games = useStore((s) => s.games);
  const [period, setPeriod] = useState<Period>('ano');
  const [cat, setCat] = useState<Category>('pontos');

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

  return (
    <Screen>
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

      {rows.length === 0 && (
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
                  {displayName(r.p)}
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
        <Card key={r.p.id} onPress={() => router.push(`/player/${r.p.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 28, textAlign: 'center', fontSize: i < 3 && r.value !== null ? 20 : 15, color: colors.muted, fontFamily: fonts.display }}>
              {r.value === null ? '–' : i < 3 ? MEDALS[i] : `${i + 1}º`}
            </Text>
            <Avatar name={r.p.name} photo={r.p.photo} size={36} color={positionColors[r.p.position]} />
            <View style={{ flex: 1 }}>
              <Text style={text.title} numberOfLines={1}>
                {displayName(r.p)}
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
