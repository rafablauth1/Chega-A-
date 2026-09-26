import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Achievements } from '@/components/Achievements';
import { AthleteInfo, PhotoCarousel } from '@/components/Athlete';
import { Empty, Screen, SectionTitle, Stat, text } from '@/components/ui';
import { useAuth, type Profile } from '@/auth';
import { fetchGamesOf } from '@/cloud';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';
import type { Game } from '@/types';
import { achievementsFor } from '@/utils/achievements';
import { toLocalIso } from '@/utils/format';
import { gameRatingAverage, scoreColor } from '@/utils/rating';
import { computeStats } from '@/utils/stats';

/** Perfil de atleta de um colega de grupo (ou o próprio, "como os outros veem"). */
export default function AthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups } = useAuth();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setProfile((data as Profile) ?? null));
    fetchGamesOf(groups.map((g) => g.id)).then(setGames).catch(() => {});
  }, [id, groups]);

  const career = useMemo(() => {
    const nowIso = toLocalIso(new Date());
    const played = games.filter((g) => g.date <= nowIso);
    return {
      stats: computeStats(played, nowIso)[id] ?? null,
      perf: gameRatingAverage(id, played),
      achievements: achievementsFor(id, played, nowIso),
    };
  }, [games, id]);

  if (profile === undefined) return <Screen>{null}</Screen>;
  if (profile === null) {
    return (
      <Screen>
        <Empty icon="person-outline" title="Perfil não encontrado" text="Você só vê o perfil de quem está em algum grupo com você." />
      </Screen>
    );
  }

  const { stats, perf } = career;

  return (
    <Screen>
      <Stack.Screen options={{ title: profile.nickname || profile.name }} />
      <PhotoCarousel profile={profile} />
      <AthleteInfo profile={profile} showContacts />

      <SectionTitle>Nos seus grupos</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Stat label="Jogos" value={String(stats?.games ?? 0)} />
        <Stat label="Gols" value={String(stats?.goals ?? 0)} color={colors.primary} />
        <Stat label="Assist." value={String(stats?.assists ?? 0)} color={colors.primary} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Stat label="Nota média" value={perf === null ? '—' : perf.toFixed(1)} color={perf === null ? colors.muted : scoreColor(perf)} />
        <Stat label="Craque" value={`🏆 ${stats?.mvps ?? 0}`} color={colors.gold} />
        <Stat label="V / E / D" value={`${stats?.wins ?? 0}/${stats?.draws ?? 0}/${stats?.losses ?? 0}`} />
      </View>
      {!stats && <Text style={text.muted}>Ainda sem jogos registrados com você.</Text>}

      <Achievements list={career.achievements} />
    </Screen>
  );
}
