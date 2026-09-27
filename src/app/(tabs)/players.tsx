import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Avatar, Chip, Empty, Fab, Group, PositionTag, RatingBadge, Row, Screen, Tag, text } from '@/components/ui';
import { useCanManage } from '@/auth';
import { useStore } from '@/store';
import { colors, fonts, positionColors } from '@/theme';
import { POSITIONS, type Position } from '@/types';
import { buildRatingMap } from '@/utils/rating';

type Sort = 'nome' | 'nota';

export default function PlayersScreen() {
  const players = useStore((s) => s.players);
  const games = useStore((s) => s.games);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Position | null>(null);
  const [sort, setSort] = useState<Sort>('nome');
  const canManage = useCanManage();

  const rating = useMemo(() => buildRatingMap(players, games), [players, games]);

  const list = players
    .filter((p) => {
      const q = query.trim().toLowerCase();
      const matches = !q || p.name.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q);
      return matches && (!pos || p.position === pos);
    })
    .sort((a, b) =>
      a.active !== b.active
        ? Number(b.active) - Number(a.active)
        : sort === 'nota'
          ? rating[b.id] - rating[a.id]
          : (a.nickname || a.name).localeCompare(b.nickname || b.name),
    );

  const active = players.filter((p) => p.active).length;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {players.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <Text style={{ color: colors.chalk, fontFamily: fonts.display, fontSize: 40, lineHeight: 44 }}>{active}</Text>
              <Text style={[text.muted, { fontSize: 15 }]}>
                {active === 1 ? 'jogador ativo' : 'jogadores ativos'}
                {players.length > active ? `, ${players.length - active} parados` : ''}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.card,
                borderRadius: 12,
                paddingHorizontal: 12,
                marginBottom: 12,
              }}
            >
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                placeholder="Buscar pelo nome ou apelido"
                placeholderTextColor={colors.muted + '99'}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, color: colors.chalk, fontFamily: fonts.body, fontSize: 16, paddingVertical: 12 }}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14, flexGrow: 0 }}>
              <Chip label={sort === 'nota' ? 'Maior nota' : 'A a Z'} selected color={colors.chalk} onPress={() => setSort(sort === 'nome' ? 'nota' : 'nome')} />
              {POSITIONS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  selected={pos === p.key}
                  color={positionColors[p.key]}
                  onPress={() => setPos(pos === p.key ? null : p.key)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {players.length === 0 && (
          <Empty
            icon="people-outline"
            title="Cadastre a galera"
            text="Adicione os amigos da pelada e dê nota para cada um. As notas deixam o sorteio dos times equilibrado."
          />
        )}

        {players.length > 0 && list.length === 0 && <Empty icon="search" title="Ninguém com esse nome" text="Confira a busca ou limpe o filtro de posição." />}

        {list.length > 0 && (
          <Group>
            {list.map((p) => (
              <Row key={p.id} onPress={() => router.push(`/player/${p.id}`)} style={!p.active && { opacity: 0.45 }}>
                <Avatar name={p.name} photo={p.photo} color={positionColors[p.position]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={text.title} numberOfLines={1}>
                    {p.nickname || p.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <PositionTag position={p.position} />
                    <Text style={text.muted}>{p.type === 'mensalista' ? 'Mensalista' : 'Avulso'}</Text>
                    {!p.active && <Tag label="Parado" color={colors.danger} />}
                  </View>
                </View>
                <RatingBadge value={rating[p.id]} />
              </Row>
            ))}
          </Group>
        )}
      </Screen>
      {canManage && <Fab icon="person-add" label="Jogador" onPress={() => router.push('/player/new')} />}
    </View>
  );
}
