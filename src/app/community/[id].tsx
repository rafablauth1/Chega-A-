import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth';
import {
  COMMUNITY_ROLE_LABEL,
  communityError,
  communityMembers,
  communityScorers,
  communityTeams,
  createTeam,
  getCommunity,
  joinTeam,
  kindInfo,
  leaveCommunity,
  type Community,
  type CommunityMember,
  type CommunityScorer,
  type CommunityTeam,
} from '@/community';
import { Avatar, Button, Empty, Group, Input, PositionTag, Row, Screen, SectionTitle, Segmented, Tag, text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts, positionColors, teamColors } from '@/theme';
import { choose, confirm, notify } from '@/utils/confirm';
import { deletePhoto, pickPhoto, uploadCommunityPhoto } from '@/utils/photos';

type Tab = 'times' | 'ranking' | 'membros';
const MEDALS = ['🥇', '🥈', '🥉'];

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, refresh, setActiveGroup } = useAuth();
  const userId = session?.user.id ?? '';
  const [community, setCommunity] = useState<Community | null | undefined>(undefined);
  const [teams, setTeams] = useState<CommunityTeam[]>([]);
  const [scorers, setScorers] = useState<CommunityScorer[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [tab, setTab] = useState<Tab>('times');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    Promise.all([getCommunity(id, userId), communityTeams(id), communityScorers(id, 10), communityMembers(id)])
      .then(([c, t, s, m]) => {
        setCommunity(c);
        setTeams(t);
        setScorers(s);
        setMembers(m);
      })
      .catch((e) => {
        setCommunity(null);
        notify('Não deu para carregar', communityError(e.message));
      });
  }, [id, userId]);

  useFocusEffect(load);

  if (community === undefined) return <Screen>{null}</Screen>;
  if (!community) {
    return (
      <Screen>
        <Empty icon="alert-circle-outline" title="Comunidade não encontrada" text="Talvez você tenha saído dela ou ela foi apagada." />
      </Screen>
    );
  }

  const info = kindInfo(community.kind);
  const isAdmin = community.role !== 'member';

  const openTeam = async (t: CommunityTeam) => {
    try {
      if (!t.is_member) await joinTeam(t.group_id);
      await refresh();
      setActiveGroup(t.group_id);
      router.dismissTo('/');
    } catch (e: any) {
      notify('Não deu certo', communityError(e.message));
    }
  };

  const addTeam = async () => {
    if (teamName.trim().length < 2) return notify('Dê um nome para o time');
    try {
      setBusy(true);
      const gid = await createTeam(community.id, teamName);
      setTeamName('');
      await refresh();
      setActiveGroup(gid);
      load();
      notify('Time criado!', 'Você é o dono do time. Chame a galera pelo código da comunidade.');
    } catch (e: any) {
      notify('Não deu certo', communityError(e.message));
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    Share.share({
      message: `⚽ Bora jogar no ${community.name}!\n\nBaixe o Vaia Aí, vá em Comunidades e entre com o código: ${community.invite_code}`,
    });

  const setPhoto = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source);
    if (!uri) return;
    try {
      const url = await uploadCommunityPhoto(community.id, uri);
      const { error } = await supabase.from('communities').update({ photo: url }).eq('id', community.id);
      if (error) return notify('Não deu certo', communityError(error.message));
      if (community.photo) await deletePhoto(community.photo).catch(() => {});
      load();
    } catch (e: any) {
      notify('Não deu certo', e?.message ?? '');
    }
  };

  const removePhoto = async () => {
    const old = community.photo;
    const { error } = await supabase.from('communities').update({ photo: null }).eq('id', community.id);
    if (error) return notify('Não deu certo', communityError(error.message));
    if (old) await deletePhoto(old).catch(() => {});
    load();
  };

  const changePhoto = () =>
    choose('Foto da comunidade', [
      { text: 'Tirar foto', onPress: () => setPhoto('camera') },
      { text: 'Escolher da galeria', onPress: () => setPhoto('library') },
      ...(community.photo ? [{ text: 'Remover foto', destructive: true, onPress: removePhoto }] : []),
    ]);

  const leave = () =>
    confirm('Sair da comunidade', `Você sai de ${community.name}. Os times em que você joga continuam normais.`, async () => {
      try {
        await leaveCommunity(community.id, userId);
        router.back();
      } catch (e: any) {
        notify('Não deu certo', communityError(e.message));
      }
    }, 'Sair');

  // Ranking de times: gols marcados e jogos disputados
  const ranking = [...teams].sort((a, b) => b.goals - a.goals || b.games - a.games);
  const totalGoals = teams.reduce((s, t) => s + t.goals, 0);
  const totalGames = teams.reduce((s, t) => s + t.games, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: info.label }} />

      <View style={styles.hero}>
        <Pressable onPress={isAdmin ? changePhoto : undefined} accessibilityLabel={isAdmin ? 'Trocar foto da comunidade' : undefined}>
          <View>
            {community.photo ? (
              <Avatar name={community.name} photo={community.photo} size={72} color={colors.primary} />
            ) : (
              <Text style={{ fontSize: 40 }}>{info.icon}</Text>
            )}
            {isAdmin && (
              <View
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: 4,
                  borderWidth: 2,
                  borderColor: colors.bg,
                }}
              >
                <Ionicons name="camera" size={12} color={colors.onPrimary} />
              </View>
            )}
          </View>
        </Pressable>
        <Text style={styles.name}>{community.name}</Text>
        {!!community.description && <Text style={[text.body, { color: colors.muted, lineHeight: 21 }]}>{community.description}</Text>}
        <View style={styles.numbers}>
          <Num value={teams.length} label={teams.length === 1 ? 'time' : 'times'} />
          <Num value={members.length} label={members.length === 1 ? 'membro' : 'membros'} />
          <Num value={totalGames} label="jogos" />
          <Num value={totalGoals} label="gols" />
        </View>
        <Pressable onPress={invite} style={({ pressed }) => [styles.code, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[text.muted, { fontSize: 13 }]}>Código para convidar</Text>
            <Text style={styles.codeText}>{community.invite_code}</Text>
          </View>
          <Ionicons name="share-social" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <Segmented
        options={[
          { key: 'times', label: 'Times' },
          { key: 'ranking', label: 'Ranking' },
          { key: 'membros', label: 'Membros' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'times' && (
        <>
          {teams.length === 0 ? (
            <Empty icon="shirt-outline" title="Nenhum time ainda" text={`Crie o primeiro time da comunidade. ${info.teamHint}.`} />
          ) : (
            <Group>
              {teams.map((t, i) => (
                <Row key={t.group_id} onPress={() => openTeam(t)}>
                  <View style={[styles.shirt, { backgroundColor: teamColors[i % teamColors.length] + '26' }]}>
                    <Ionicons name="shirt" size={20} color={teamColors[i % teamColors.length]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={text.title} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={text.muted}>
                      {t.members} {t.members === 1 ? 'jogador' : 'jogadores'}, {t.games} jogos
                    </Text>
                  </View>
                  {t.is_member ? (
                    <Tag label="Meu time" color={colors.success} />
                  ) : (
                    <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>Entrar</Text>
                  )}
                </Row>
              ))}
            </Group>
          )}

          <SectionTitle>Novo time</SectionTitle>
          <Input value={teamName} onChangeText={setTeamName} placeholder={info.teamHint} maxLength={50} />
          <Button title={busy ? 'Criando...' : 'Criar time'} icon="add" variant="secondary" onPress={addTeam} disabled={busy} />
          <Text style={[text.muted, { marginTop: 8 }]}>Quem cria vira o dono do time: marca os jogos, sorteia e cuida do caixa dele.</Text>
        </>
      )}

      {tab === 'ranking' && (
        <>
          {ranking.length === 0 ? (
            <Empty icon="trophy-outline" title="Sem times ainda" text="O ranking aparece quando os times começarem a jogar." />
          ) : (
            <>
              <SectionTitle>Times que mais marcam</SectionTitle>
              <Group>
                {ranking.map((t, i) => (
                  <Row key={t.group_id}>
                    <Text style={styles.pos}>{i < 3 ? MEDALS[i] : `${i + 1}º`}</Text>
                    <Text style={[text.title, { flex: 1 }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={text.muted}>{t.games} jogos</Text>
                    <Text style={styles.value}>{t.goals}</Text>
                  </Row>
                ))}
              </Group>
            </>
          )}

          <SectionTitle>Artilharia da comunidade</SectionTitle>
          {scorers.length === 0 ? (
            <Text style={text.muted}>Nenhum gol registrado ainda. Os gols do placar ao vivo de cada time contam aqui.</Text>
          ) : (
            <Group>
              {scorers.map((s, i) => (
                <Row key={s.player_id}>
                  <Text style={styles.pos}>{i < 3 ? MEDALS[i] : `${i + 1}º`}</Text>
                  <Avatar name={s.name} photo={s.photo} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={text.title} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={text.muted} numberOfLines={1}>
                      {s.team}
                    </Text>
                  </View>
                  <Text style={styles.value}>{s.goals}</Text>
                </Row>
              ))}
            </Group>
          )}
        </>
      )}

      {tab === 'membros' && (
        <>
          <Group>
            {members.map((m) => (
              <Row key={m.user_id} onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: m.user_id } })}>
                <Avatar name={m.name} photo={m.photo} color={positionColors[m.position]} />
                <View style={{ flex: 1 }}>
                  <Text style={text.title} numberOfLines={1}>
                    {m.nickname || m.name}
                  </Text>
                  <PositionTag position={m.position} />
                </View>
                {m.role !== 'member' && <Tag label={COMMUNITY_ROLE_LABEL[m.role]} color={colors.gold} />}
              </Row>
            ))}
          </Group>
          {isAdmin && (
            <Text style={[text.muted, { marginBottom: 12 }]}>Para chamar mais gente, toque no código de convite lá em cima.</Text>
          )}
        </>
      )}

      {community.role !== 'owner' && (
        <Button title="Sair da comunidade" icon="exit-outline" variant="ghost" onPress={leave} style={{ marginTop: 24 }} />
      )}
    </Screen>
  );
}

function Num({ value, label }: { value: number; label: string }) {
  return (
    <View>
      <Text style={{ color: colors.chalk, fontFamily: fonts.display, fontSize: 30, lineHeight: 32 }}>{value}</Text>
      <Text style={[text.muted, { fontSize: 13 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.card, borderRadius: 22, padding: 20, gap: 8, marginBottom: 16 },
  name: { color: colors.chalk, fontFamily: fonts.displayBlack, fontSize: 38, lineHeight: 42 },
  numbers: { flexDirection: 'row', gap: 22, marginTop: 6, flexWrap: 'wrap' },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + '66',
    borderStyle: 'dashed',
  },
  codeText: { color: colors.chalk, fontFamily: fonts.display, fontSize: 30, letterSpacing: 6 },
  shirt: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pos: { width: 30, textAlign: 'center', color: colors.muted, fontFamily: fonts.display, fontSize: 18 },
  value: { color: colors.primary, fontFamily: fonts.display, fontSize: 24, minWidth: 32, textAlign: 'right' },
});
