import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { DAYS, PERIODS, slotKey } from '../utils/availability';

/** Grade dia × turno para marcar quando dá para jogar. Toque no dia marca/desmarca o dia inteiro. */
export function AvailabilityGrid({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const has = (k: string) => value.includes(k);
  const toggle = (k: string) => onChange(has(k) ? value.filter((x) => x !== k) : [...value, k]);
  const toggleDay = (day: string) => {
    const keys = PERIODS.map((p) => slotKey(day, p.key));
    const all = keys.every(has);
    onChange(all ? value.filter((x) => !keys.includes(x)) : [...new Set([...value, ...keys])]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.periodCol} />
        {DAYS.map((d) => (
          <Pressable key={d.key} onPress={() => toggleDay(d.key)} style={styles.dayHead} hitSlop={4}>
            <Text style={styles.dayText}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
      {PERIODS.map((p) => (
        <View key={p.key} style={styles.row}>
          <View style={styles.periodCol}>
            <Ionicons name={p.icon} size={14} color={colors.muted} />
            <Text style={styles.periodText}>{p.label}</Text>
          </View>
          {DAYS.map((d) => {
            const k = slotKey(d.key, p.key);
            const on = has(k);
            return (
              <Pressable
                key={k}
                onPress={() => toggle(k)}
                style={[styles.cell, on && styles.cellOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${d.label} ${p.label}`}
              >
                {on && <Ionicons name="football" size={14} color={colors.onPrimary} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  periodCol: { width: 58, flexDirection: 'row', alignItems: 'center', gap: 3 },
  periodText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  dayHead: { flex: 1, alignItems: 'center' },
  dayText: { color: colors.chalk, fontFamily: fonts.semibold, fontSize: 12 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
