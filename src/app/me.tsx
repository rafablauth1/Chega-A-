import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Achievements } from '@/components/Achievements';
import { profileCompletion } from '@/components/Athlete';
import { PlayerCard, toOvr } from '@/components/PlayerCard';
import { Avatar, Button, Card, Empty, Screen, SectionTitle, Stat, Tag, text } from '@/components/ui';
import { ageOf, ROLE_LABEL, useAuth } from '@/auth';
import { fetchGamesOf } from '@/cloud';
import { isCloudEnabled, supabase } from '@/lib/supabase';
import { colors, positionColors } from '@/theme';
import type { Game, Player } from '@/types';
import { achievementsFor } from '@/utils/achievements';
import { confirm } from '@/utils/confirm';
import { toLocalIso } from '@/utils/format';
import { gameRatingAverage, overallRating, scoreColor } from '@/utils/rating';
import { shareView } from '@/utils/share';
import { computeStats, confirmedIds } from '@/utils/stats';

export default function MeScreen() {
  const { session, profile, groups, activeGroup } = useAuth();
  const [games, setGames] = useState<(Game & { groupId: string })[]>([]);
  const cardRef = useRef<View>(null);

  // Jogos de todos os grupos: as estatísticas do atleta somam tudo
  const groupIds = groups.map((g) => g.id).join(',');
  useEffect(() => {
    if (!groupIds) return setGames([]);
    fetchGamesOf(groupIds.split(',')).then(setGames).catch(() => {});
  }, [groupIds]);

  const myId = session?.user.id ?? '';
  const career = useMemo(() => {
    const nowIso = toLocalIso(new Date());
    const played = games.filter((g) => g.date <= nowIso);
    return {
      stats: computeStats(played, nowIso)[myId] ?? null,
      achievements: achievementsFor(myId, played, nowIso),
      perf: gameRatingAverage(myId, played),
      byGroup: groups
        .map((gr) => ({ group: gr, count: played.filter((g) => g.groupId === gr.id && confirmedIds(g).includes(myId)).length }))
        .filter((x) => x.count > 0),
      played,
    };
  }, [games, groups, myId]);

  if (!isCloudEnabled) {
    return (
      <Screen>
        <Empty
          icon="cloud-offline-outline"
          title="Contas ainda não ativadas"
          text="Falta ligar o app ao servidor (Supabase). Enquanto isso, tudo continua salvo só neste celular."
        />
      </Screen>
    );
  }
  if (!session || !profile) return <Screen>{null}</Screen>;

  const signOut = () => confirm('Sair da conta', 'Você vai precisar entrar de novo com e-mail e senha.', () => supabase.auth.signOut(), 'Sair');

  const me: Player = {
    id: myId,
    name: profile.name,
    nickname: profile.nickname ?? undefined,
    position: profile.position,
    skills: profile.skills,
    type: 'avulso',
    active: true,
    createdAt: '',
    photo: profile.photos?.[0],
  };
  const overall = overallRating(me, career.played);
  const { stats, perf } = career;
  const done = profileCompletion(profile);
  const age = ageOf(profile.birth_date);

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Avatar name={profile.name || '?'} photo={profile.photos?.[0]} size={96} color={positionColors[profile.position]} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {profile.nickname || profile.name}
          {age !== null ? `, ${age}` : ''}
        </Text>
        <Text style={text.muted}>{session.user.email}</Text>
      </View>

      {done < 1 && (
        <Card onPress={() => router.push('/profile-edit')} style={{ gap: 8, borderColor: colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={text.title}>Perfil {Math.round(done * 100)}% completo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
          <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3 }}>
            <View style={{ height: 6, width: `${done * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
          </View>
          <Text style={text.muted}>Coloque fotos e seus dados para a galera te conhecer.</Text>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <Button title="Editar perfil" icon="create-outline" onPress={() => router.push('/profile-edit')} style={{ flex: 1 }} />
        <Button
          title="Ver perfil"
          icon="eye-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: myId } })}
          style={{ flex: 1 }}
        />
      </View>

      <PlayerCard
        ref={cardRef}
        player={me}
        overall={overall}
        groupName="Perfil de atleta"
        extra={stats ? { games: stats.games, goals: stats.goals, mvps: stats.mvps } : undefined}
      />
      <Button
        title="Compartilhar meu card"
        icon="share-social"
        variant="secondary"
        style={{ marginVertical: 10 }}
        onPress={() =>
          shareView(
            cardRef,
            `⚽ ${me.nickname || me.name} · ${toOvr(overall)} OVR (${me.position})\n` +
              (stats ? `${stats.games} jogos · ${stats.goals} gols · ${stats.assists} assist. · ${stats.mvps}x craque` : ''),
            'Meu card',
          )
        }
      />

      <SectionTitle>Carreira</SectionTitle>
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
      {career.byGroup.length > 1 && (
        <Card>
          {career.byGroup.map(({ group, count }) => (
            <View key={group.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={text.body}>{group.name}</Text>
              <Text style={text.muted}>{count} jogos</Text>
            </View>
          ))}
        </Card>
      )}

      <Achievements list={career.achievements} />

      <SectionTitle right={<Button title="Novo" icon="add" variant="ghost" onPress={() => router.push('/group-join')} />}>
        Meus grupos
      </SectionTitle>
      {groups.length === 0 ? (
        <Card>
          <Text style={text.body}>Você ainda não está em nenhum grupo.</Text>
          <Text style={[text.muted, { marginTop: 4 }]}>Crie a sua pelada ou entre com o código que um amigo te mandou.</Text>
          <Button title="Criar ou entrar num grupo" icon="people" style={{ marginTop: 12 }} onPress={() => router.push('/group-join')} />
        </Card>
      ) : (
        groups.map((g) => (
          <Card
            key={g.id}
            onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Ionicons name="football" size={22} color={colors.primary} />
            <Text style={[text.title, { flex: 1 }]}>{g.name}</Text>
            {g.id === activeGroup?.id && <Tag label="ABERTO" color={colors.primary} />}
            <Tag label={ROLE_LABEL[g.role]} color={g.role === 'player' ? colors.muted : colors.gold} />
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        ))
      )}

      <Button title="Sair da conta" icon="log-out" variant="danger" onPress={signOut} style={{ marginTop: 24 }} />
    </Screen>
  );
}
