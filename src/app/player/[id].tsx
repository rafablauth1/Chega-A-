import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { PlayerCard, toOvr } from '@/components/PlayerCard';
import { Button, Card, Chip, Input, Label, RatingBadge, Screen, SectionTitle, Stars, Stat, text } from '@/components/ui';
import { achievementsFor } from '@/utils/achievements';
import { displayName } from '@/utils/names';
import { shareView } from '@/utils/share';
import { computeStats } from '@/utils/stats';
import { useCanManage } from '@/auth';
import { useStore } from '@/store';
import { colors, positionColors } from '@/theme';
import { POSITIONS, SKILLS, type PlayerType, type Position, type Skills } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { formatShortDate, toLocalIso } from '@/utils/format';
import { gameRatingAverage, overallRating } from '@/utils/rating';

const DEFAULT_SKILLS: Skills = { tecnica: 3, fisico: 3, passe: 3, finalizacao: 3, defesa: 3 };

export default function PlayerFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => s.players.find((p) => p.id === id));
  const games = useStore((s) => s.games);
  const { addPlayer, updatePlayer, removePlayer } = useStore.getState();

  const [name, setName] = useState(existing?.name ?? '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [position, setPosition] = useState<Position>(existing?.position ?? 'MEI');
  const [type, setType] = useState<PlayerType>(existing?.type ?? 'avulso');
  const [skills, setSkills] = useState<Skills>(existing?.skills ?? DEFAULT_SKILLS);
  const [active, setActive] = useState(existing?.active ?? true);
  const groupName = useStore((s) => s.settings.groupName);
  const cardRef = useRef<View>(null);
  const canManage = useCanManage();
  // Quem tem conta edita nome, apelido, WhatsApp e posição no próprio perfil
  const fromProfile = !!existing?.account;

  if (!isNew && !existing) {
    return (
      <Screen>
        <Text style={text.body}>Jogador não encontrado.</Text>
      </Screen>
    );
  }

  const draft = { name: name.trim(), nickname: nickname.trim(), phone: phone.trim(), position, type, skills, active };
  const perf = existing ? gameRatingAverage(existing.id, games) : null;
  const overall = overallRating({ ...draft, id: existing?.id ?? '', createdAt: '' }, games);
  const nowIso = toLocalIso(new Date());
  const stats = existing ? computeStats(games, nowIso)[existing.id] ?? null : null;
  const achievements = existing ? achievementsFor(existing.id, games, nowIso) : [];
  const history = existing
    ? games
        .filter((g) => g.attendees.includes(existing.id))
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const save = () => {
    if (!draft.name) return notify('Informe o nome do jogador');
    if (isNew) addPlayer(draft);
    else updatePlayer(id, draft);
    router.back();
  };

  const remove = () =>
    confirm('Excluir jogador', `Remover ${draft.name} do grupo? Ele sai também das listas dos jogos.`, () => {
      removePlayer(id);
      router.back();
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Novo jogador' : draft.nickname || draft.name || 'Jogador' }} />

      {existing && (
        <>
          <PlayerCard
            ref={cardRef}
            player={{ ...existing, ...draft }}
            overall={overall}
            groupName={groupName}
            extra={stats ? { games: stats.games, goals: stats.goals, mvps: stats.mvps } : undefined}
          />
          <Button
            title="Compartilhar card"
            icon="share-social"
            variant="secondary"
            style={{ marginVertical: 10 }}
            onPress={() =>
              shareView(
                cardRef,
                `⚽ ${displayName(existing)} · ${toOvr(overall)} OVR (${existing.position})\n` +
                  (stats ? `${stats.games} jogos · ${stats.goals} gols · ${stats.assists} assist. · ${stats.mvps}x craque` : ''),
                'Card do jogador',
              )
            }
          />

          {stats && (
            <>
              <SectionTitle>Estatísticas</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Stat label="Jogos" value={String(stats.games)} />
                <Stat label="Gols" value={String(stats.goals)} color={colors.primary} />
                <Stat label="Assist." value={String(stats.assists)} color={colors.primary} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Stat label="Craque" value={`🏆 ${stats.mvps}`} color={colors.gold} />
                <Stat label="V / E / D" value={`${stats.wins}/${stats.draws}/${stats.losses}`} />
              </View>
            </>
          )}

          <SectionTitle right={<Text style={text.muted}>{achievements.filter((a) => a.unlocked).length}/{achievements.length}</Text>}>
            Conquistas
          </SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {achievements.map((a) => (
              <View
                key={a.key}
                style={{
                  width: '31.5%',
                  flexGrow: 1,
                  backgroundColor: a.unlocked ? colors.gold + '1F' : colors.card,
                  borderColor: a.unlocked ? colors.gold : colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  alignItems: 'center',
                  opacity: a.unlocked ? 1 : 0.55,
                }}
              >
                <Text style={{ fontSize: 26 }}>{a.unlocked ? a.icon : '🔒'}</Text>
                <Text style={[text.title, { fontSize: 12, textAlign: 'center' }]} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={[text.muted, { fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>
                  {a.description}
                </Text>
                {!a.unlocked && (
                  <View style={{ height: 4, width: '100%', backgroundColor: colors.border, borderRadius: 2, marginTop: 6 }}>
                    <View
                      style={{
                        height: 4,
                        width: `${(a.current / a.target) * 100}%`,
                        backgroundColor: colors.primary,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {canManage && <SectionTitle>Dados</SectionTitle>}
        </>
      )}

      {canManage && fromProfile && (
        <Text style={[text.muted, { marginBottom: 14 }]}>
          Nome, apelido, WhatsApp e posição vêm do perfil do atleta. Só ele pode mudar, pelo próprio app.
        </Text>
      )}

      {canManage && !fromProfile && (
        <>
      <Input label="Nome *" value={name} onChangeText={setName} placeholder="Ex.: Carlos Eduardo" autoFocus={isNew} />
      <Input label="Apelido" value={nickname} onChangeText={setNickname} placeholder="Ex.: Cadu" />
      <Input label="WhatsApp" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />

      <Label>Posição</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {POSITIONS.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={position === p.key}
            color={positionColors[p.key]}
            onPress={() => setPosition(p.key)}
          />
        ))}
      </View>
        </>
      )}

      {canManage && (
        <>

      <Label>Tipo</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
        <Chip label="Avulso (paga por jogo)" selected={type === 'avulso'} onPress={() => setType('avulso')} />
        <Chip label="Mensalista" selected={type === 'mensalista'} onPress={() => setType('mensalista')} />
      </View>

      <SectionTitle right={<RatingBadge value={overall} />}>Avaliação</SectionTitle>
      <Card>
        {SKILLS.map((s) => (
          <View
            key={s.key}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
          >
            <Text style={text.body}>{s.label}</Text>
            <Stars value={skills[s.key]} onChange={(v) => setSkills({ ...skills, [s.key]: v })} size={26} />
          </View>
        ))}
        <Text style={[text.muted, { marginTop: 8 }]}>
          {perf === null
            ? 'Depois dos jogos, as notas da partida também entram na média.'
            : `Nota média nas partidas: ${perf.toFixed(1)} · a nota geral junta habilidades (60%) e partidas (40%).`}
        </Text>
      </Card>

      {!isNew && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Ativo</Text>
            <Text style={text.muted}>Inativos não aparecem na lista de presença</Text>
          </View>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ true: colors.primaryDark, false: colors.border }}
            thumbColor={active ? colors.primary : colors.muted}
          />
        </Card>
      )}

      <Button title="Salvar" icon="checkmark" onPress={save} style={{ marginTop: 8 }} />
        </>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>Jogos ({history.length})</SectionTitle>
          <Card>
            {history.slice(0, 10).map((g) => (
              <View key={g.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={text.body}>
                  {formatShortDate(g.date)} {g.location ? `· ${g.location}` : ''}
                </Text>
                <Text style={{ color: g.ratings[existing!.id] ? colors.gold : colors.muted, fontWeight: '700' }}>
                  {g.ratings[existing!.id] ? `★ ${g.ratings[existing!.id]}` : '—'}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {canManage && !isNew && (
        <Button
          title={fromProfile ? 'Remover do grupo' : 'Excluir jogador'}
          icon="trash-outline"
          variant="danger"
          onPress={remove}
          style={{ marginTop: 16 }}
        />
      )}
    </Screen>
  );
}
