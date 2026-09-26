import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Card, Chip, Empty, Fab, Input, PositionTag, RatingBadge, Screen, Tag, text } from '@/components/ui';
import { useCanManage } from '@/auth';
import { useStore } from '@/store';
import { colors, positionColors } from '@/theme';
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
          : a.name.localeCompare(b.name),
    );

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {players.length > 0 && (
          <>
            <Input placeholder="Buscar jogador..." value={query} onChangeText={setQuery} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {POSITIONS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  selected={pos === p.key}
                  color={positionColors[p.key]}
                  onPress={() => setPos(pos === p.key ? null : p.key)}
                />
              ))}
              <Chip
                label={sort === 'nota' ? '↓ Nota' : 'A-Z'}
                selected
                onPress={() => setSort(sort === 'nome' ? 'nota' : 'nome')}
              />
            </View>
            <Text style={[text.muted, { marginBottom: 10 }]}>
              {players.filter((p) => p.active).length} ativos · {players.length} no total
            </Text>
          </>
        )}

        {players.length === 0 && (
          <Empty
            icon="people-outline"
            title="Cadastre a galera"
            text="Adicione os amigos da pelada e avalie cada um. As notas deixam o sorteio dos times equilibrado."
          />
        )}

        {list.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/player/${p.id}`)} style={!p.active && { opacity: 0.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={p.name} color={positionColors[p.position]} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={text.title} numberOfLines={1}>
                  {p.nickname || p.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PositionTag position={p.position} />
                  <Tag
                    label={p.type === 'mensalista' ? 'MENSALISTA' : 'AVULSO'}
                    color={p.type === 'mensalista' ? colors.primary : colors.muted}
                  />
                  {!p.active && <Tag label="INATIVO" color={colors.danger} />}
                </View>
              </View>
              <RatingBadge value={rating[p.id]} />
            </View>
          </Card>
        ))}
      </Screen>
      {canManage && <Fab icon="person-add" onPress={() => router.push('/player/new')} />}
    </View>
  );
}
