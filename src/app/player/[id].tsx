import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Chip, Input, Label, RatingBadge, Screen, SectionTitle, Stars, text } from '@/components/ui';
import { useStore } from '@/store';
import { colors, positionColors } from '@/theme';
import { POSITIONS, SKILLS, type PlayerType, type Position, type Skills } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { formatShortDate } from '@/utils/format';
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

      {!isNew && <Button title="Excluir jogador" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 16 }} />}
    </Screen>
  );
}
