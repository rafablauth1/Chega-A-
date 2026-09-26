import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Achievements } from '@/components/Achievements';
import { PlayerCard, toOvr } from '@/components/PlayerCard';
import { Button, Card, Chip, Empty, Input, Label, Screen, SectionTitle, Stars, Stat, Tag, text } from '@/components/ui';
import { authErrorMessage, ROLE_LABEL, useAuth } from '@/auth';
import { fetchGamesOf } from '@/cloud';
import { isCloudEnabled, supabase } from '@/lib/supabase';
import { colors, positionColors } from '@/theme';
import { POSITIONS, SKILLS, type Game, type Player, type Position, type Skills } from '@/types';
import { achievementsFor } from '@/utils/achievements';
import { confirm, notify } from '@/utils/confirm';
import { toLocalIso } from '@/utils/format';
import { gameRatingAverage, overallRating, scoreColor } from '@/utils/rating';
import { shareView } from '@/utils/share';
import { computeStats, confirmedIds } from '@/utils/stats';

const DEFAULT_SKILLS: Skills = { tecnica: 3, fisico: 3, passe: 3, finalizacao: 3, defesa: 3 };

export default function MeScreen() {
  const { session, profile, groups, activeGroup, refresh } = useAuth();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState<Position>('MEI');
  const [skills, setSkills] = useState<Skills>(DEFAULT_SKILLS);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setNickname(profile.nickname ?? '');
    setPhone(profile.phone ?? '');
    setPosition(profile.position);
    setSkills({ ...DEFAULT_SKILLS, ...profile.skills });
  }, [profile]);

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

  const save = async () => {
    if (!name.trim()) return notify('Informe seu nome');
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), nickname: nickname.trim() || null, phone: phone.trim() || null, position, skills })
      .eq('id', profile.id);
    setBusy(false);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    await refresh();
    notify('Perfil salvo!');
  };

  const signOut = () => confirm('Sair da conta', 'Você vai precisar entrar de novo com e-mail e senha.', () => supabase.auth.signOut(), 'Sair');

  const me: Player = {
    id: myId,
    name: name || profile.name,
    nickname: nickname || undefined,
    position,
    skills,
    type: 'avulso',
    active: true,
    createdAt: '',
  };
  const overall = overallRating(me, career.played);
  const { stats, perf } = career;

  return (
    <Screen>
      <PlayerCard
        ref={cardRef}
        player={me}
        overall={overall}
        groupName="Perfil de atleta"
        extra={stats ? { games: stats.games, goals: stats.goals, mvps: stats.mvps } : undefined}
      />
      <Text style={[text.muted, { textAlign: 'center', marginTop: 6 }]}>{session.user.email}</Text>
      <Button
        title="Compartilhar meu card"
        icon="share-social"
        variant="secondary"
        style={{ marginVertical: 10 }}
        onPress={() =>
          shareView(
            cardRef,
            `⚽ ${nickname || name} · ${toOvr(overall)} OVR (${position})\n` +
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

      <SectionTitle
        right={<Button title="Novo" icon="add" variant="ghost" onPress={() => router.push('/group-join')} />}
      >
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
          <Card key={g.id} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="football" size={22} color={colors.primary} />
            <Text style={[text.title, { flex: 1 }]}>{g.name}</Text>
            {g.id === activeGroup?.id && <Tag label="ABERTO" color={colors.primary} />}
            <Tag label={ROLE_LABEL[g.role]} color={g.role === 'player' ? colors.muted : colors.gold} />
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        ))
      )}

      <SectionTitle>Dados do atleta</SectionTitle>
      <Input label="Nome" value={name} onChangeText={setName} />
      <Input label="Apelido" value={nickname} onChangeText={setNickname} placeholder="Opcional" />
      <Input label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999" />

      <Label>Posição</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {POSITIONS.map((p) => (
          <Chip key={p.key} label={p.label} selected={position === p.key} color={positionColors[p.key]} onPress={() => setPosition(p.key)} />
        ))}
      </View>

      <Label>Como você se avalia</Label>
      <Card>
        {SKILLS.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={text.body}>{s.label}</Text>
            <Stars value={skills[s.key]} onChange={(v) => setSkills({ ...skills, [s.key]: v })} />
          </View>
        ))}
      </Card>

      <Button title={busy ? 'Salvando...' : 'Salvar perfil'} icon="checkmark" onPress={save} disabled={busy} />
      <Button title="Sair da conta" icon="log-out" variant="danger" onPress={signOut} style={{ marginTop: 24 }} />
    </Screen>
  );
}
