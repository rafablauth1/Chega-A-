import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Achievements } from '@/components/Achievements';
import { AthleteInfo, PhotoCarousel } from '@/components/Athlete';
import { Avatar, Empty, Screen, SectionTitle, Stat, text } from '@/components/ui';
import { useAuth, type Profile } from '@/auth';
import { fetchGamesOf } from '@/cloud';
import { fetchPerson } from '@/people';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';
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
  const [places, setPlaces] = useState<{ id: string; name: string; photo: string | null }[]>([]);

  useEffect(() => {
    fetchPerson(id)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null));
    fetchGamesOf(groups.map((g) => g.id)).then(setGames).catch(() => {});
    // Clubes e comunidades que a gente compartilha (o RLS já garante que só vejo o que também sou de dentro)
    Promise.all([
      supabase.from('group_members').select('groups(id, name, photo)').eq('user_id', id),
      supabase.from('community_members').select('communities(id, name, photo)').eq('user_id', id),
    ])
      .then(([g, c]) => {
        const clubs = ((g.data ?? []) as any[]).map((r) => r.groups).filter(Boolean);
        const comms = ((c.data ?? []) as any[]).map((r) => r.communities).filter(Boolean);
        setPlaces([...clubs, ...comms]);
      })
      .catch(() => {});
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

      {places.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} style={{ marginTop: 4 }}>
          {places.map((p) => (
            <View key={p.id} style={{ alignItems: 'center', width: 64 }}>
              <Avatar name={p.name} photo={p.photo} color={colors.primary} size={40} />
              <Text style={[text.muted, { fontSize: 11, textAlign: 'center', marginTop: 2 }]} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

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
      <Text
        style={{ color: colors.primary, fontFamily: fonts.semibold, marginBottom: 8 }}
        onPress={() => router.push('/scoring-help')}
      >
        Como essa nota é calculada?
      </Text>

      <Achievements list={career.achievements} />
    </Screen>
  );
}
