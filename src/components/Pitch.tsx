import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { Player, Position } from '../types';
import { toTen } from '../utils/rating';
import { initials } from '../utils/format';
import { displayName } from '../utils/names';

/** Altura (em %) de cada linha no campo, do ataque (topo) ao gol (base). */
const ROWS: { pos: Position; top: number }[] = [
  { pos: 'ATA', top: 10 },
  { pos: 'MEI', top: 36 },
  { pos: 'ZAG', top: 61 },
  { pos: 'GOL', top: 84 },
];

const LINE = 'rgba(255,255,255,0.35)';

export function Pitch({
  players,
  color,
  rating,
  selectedId,
  onPressPlayer,
}: {
  players: Player[];
  color: string;
  rating?: Record<string, number>;
  selectedId?: string | null;
  onPressPlayer?: (id: string) => void;
}) {
  return (
    <View style={styles.field}>
      {/* Faixas da grama */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={[styles.stripe, { top: `${i * 12.5}%`, backgroundColor: i % 2 ? '#1F7A3A' : '#23863F' }]} />
      ))}

      {/* Marcações */}
      <View style={styles.border} />
      <View style={styles.midLine} />
      <View style={styles.circle} />
      <View style={[styles.box, { bottom: '3%' }]} />
      <View style={[styles.smallBox, { bottom: '3%' }]} />
      <View style={[styles.box, { top: '3%', borderTopWidth: 0, borderBottomWidth: 1.5 }]} />
      <View style={[styles.smallBox, { top: '3%', borderTopWidth: 0, borderBottomWidth: 1.5 }]} />

      {/* Jogadores por linha */}
      {ROWS.map(({ pos, top }) => {
        const row = players.filter((p) => p.position === pos);
        if (!row.length) return null;
        const size = row.length > 4 ? 36 : 44;
        return (
          <View key={pos} style={[styles.row, { top: `${top}%` }]}>
            {row.map((p) => (
              <Marker
                key={p.id}
                player={p}
                color={color}
                size={size}
                rating={rating?.[p.id]}
                selected={selectedId === p.id}
                onPress={onPressPlayer ? () => onPressPlayer(p.id) : undefined}
              />
            ))}
          </View>
        );
      })}

      {players.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Time vazio</Text>
        </View>
      )}
    </View>
  );
}

function Marker({
  player,
  color,
  size,
  rating,
  selected,
  onPress,
}: {
  player: Player;
  color: string;
  size: number;
  rating?: number;
  selected: boolean;
  onPress?: () => void;
}) {
  const isGk = player.position === 'GOL';
  return (
    <Pressable onPress={onPress} style={styles.marker} hitSlop={4}>
      <View
        style={[
          styles.shirt,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isGk ? colors.warning : color,
            borderColor: selected ? '#fff' : 'rgba(0,0,0,0.35)',
            borderWidth: selected ? 3 : 2,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(player.name)}</Text>
        {rating !== undefined && (
          <View style={styles.rating}>
            <Text style={styles.ratingText}>{toTen(rating).toFixed(1)}</Text>
          </View>
        )}
        {selected && (
          <View style={styles.swap}>
            <Ionicons name="swap-horizontal" size={10} color="#000" />
          </View>
        )}
      </View>
      <View style={styles.nameTag}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName(player)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#23863F',
    marginBottom: 10,
  },
  stripe: { position: 'absolute', left: 0, right: 0, height: '12.5%' },
  border: {
    position: 'absolute',
    top: '3%',
    bottom: '3%',
    left: '4%',
    right: '4%',
    borderWidth: 1.5,
    borderColor: LINE,
  },
  midLine: { position: 'absolute', top: '50%', left: '4%', right: '4%', height: 1.5, backgroundColor: LINE },
  circle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: LINE,
  },
  box: {
    position: 'absolute',
    left: '24%',
    right: '24%',
    height: '15%',
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: LINE,
  },
  smallBox: {
    position: 'absolute',
    left: '38%',
    right: '38%',
    height: '6%',
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: LINE,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingHorizontal: 6,
  },
  marker: { alignItems: 'center', width: 72 },
  shirt: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  initials: { color: '#fff', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
  rating: {
    position: 'absolute',
    top: -6,
    right: -12,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  ratingText: { color: '#000', fontSize: 10, fontWeight: '900' },
  swap: {
    position: 'absolute',
    bottom: -4,
    left: -6,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
  },
  nameTag: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 72,
  },
  name: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
});
