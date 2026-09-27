import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, positionColors } from '../theme';
import { initials } from '../utils/format';
import { scoreColor, toTen } from '../utils/rating';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={[styles.screen, styles.screenPad]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenPad, { paddingBottom: 120 }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Lista agrupada numa superfície só, com divisórias finas entre as linhas. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.hairline} />}
          {child}
        </View>
      ))}
    </View>
  );
}

/** Linha de lista: toque inteiro, conteúdo livre. */
export function Row({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardAlt }, style]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.primary, secondary: 'transparent', danger: 'transparent', ghost: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.chalk, danger: colors.danger, ghost: colors.primary }[variant];
  const border = { primary: colors.primary, secondary: colors.border, danger: colors.danger + '66', ghost: 'transparent' }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : 1 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted + '99'} style={[styles.input, style]} {...props} />
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: color + '26', borderColor: color },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, color = colors.muted }: { label: string; color?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: color + '22' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function PositionTag({ position }: { position: string }) {
  return (
    <View style={[styles.pos, { borderColor: positionColors[position] }]}>
      <Text style={[styles.posText, { color: positionColors[position] }]}>{position}</Text>
    </View>
  );
}

export function Stars({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name: IconName = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={name} size={size} color={value >= i - 0.5 ? colors.gold : colors.border} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

export function RatingBadge({ value }: { value: number }) {
  return (
    <View style={styles.rating}>
      <Text style={styles.ratingText}>{toTen(value).toFixed(1)}</Text>
      <Ionicons name="star" size={11} color={colors.gold} />
    </View>
  );
}

/** Nota de 1 a 10 (pós-jogo). Sem onChange, só mostra. */
export function ScorePicker({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const color = scoreColor(value);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const on = value >= n;
        return (
          <Pressable
            key={n}
            disabled={!onChange}
            hitSlop={3}
            onPress={() => onChange?.(value === n ? 0 : n)}
            style={[styles.score, on && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.scoreText, on && { color: colors.bg }]}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({
  name,
  color = colors.primary,
  size = 40,
  photo,
}: {
  name: string;
  color?: string;
  size?: number;
  photo?: string | null;
}) {
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color + '88', backgroundColor: color + '26' }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '26',
        borderWidth: 1.5,
        borderColor: color + '88',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontFamily: fonts.display, fontSize: size * 0.44 }}>{initials(name)}</Text>
    </View>
  );
}

/** Abas sublinhadas (laranja de colete na ativa). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={styles.segment}>
            <Text style={[styles.segmentText, active && { color: colors.chalk }]} numberOfLines={1}>
              {o.label}
            </Text>
            <View style={[styles.segmentBar, active && { backgroundColor: colors.primary }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Check({ checked, color = colors.success }: { checked: boolean; color?: string }) {
  return (
    <Ionicons
      name={checked ? 'checkmark-circle' : 'ellipse-outline'}
      size={26}
      color={checked ? color : colors.border}
    />
  );
}

export function Empty({ icon, title, text: body }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.muted + '88'} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.emptyText}>{body}</Text>}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Fab({ icon = 'add', onPress, label }: { icon?: IconName; onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, label && styles.fabWide, pressed && styles.pressed]}>
      <Ionicons name={icon} size={26} color={colors.onPrimary} />
      {label && <Text style={styles.fabText}>{label}</Text>}
    </Pressable>
  );
}

/** Número grande (fonte de placar) com rótulo curto embaixo. */
export function Stat({ label, value, color = colors.chalk }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export const text = StyleSheet.create({
  title: { color: colors.chalk, fontSize: 16, fontFamily: fonts.semibold },
  body: { color: colors.chalk, fontSize: 15, fontFamily: fonts.body },
  muted: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
  num: { color: colors.chalk, fontFamily: fonts.display },
  display: { color: colors.chalk, fontFamily: fonts.displayBlack },
}) satisfies Record<string, TextStyle>;

const styles = StyleSheet.create({
  score: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { color: colors.muted, fontFamily: fonts.display, fontSize: 16 },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: 16 },
  pressed: { opacity: 0.8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  buttonText: { fontSize: 16, fontFamily: fonts.bold },
  label: { color: colors.muted, fontSize: 14, fontFamily: fonts.medium, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.chalk,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'center' },
  tagText: { fontSize: 12, fontFamily: fonts.semibold },
  pos: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'center' },
  posText: { fontSize: 13, fontFamily: fonts.display, letterSpacing: 0.5 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { color: colors.gold, fontFamily: fonts.display, fontSize: 20 },
  segmented: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segment: { flex: 1, alignItems: 'center', paddingTop: 10 },
  segmentText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 15, paddingBottom: 10 },
  segmentBar: { height: 3, alignSelf: 'stretch', marginHorizontal: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { color: colors.chalk, fontSize: 26, fontFamily: fonts.display, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, fontFamily: fonts.body, textAlign: 'center', lineHeight: 21, maxWidth: 340 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  section: { color: colors.chalk, fontSize: 24, fontFamily: fonts.display },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    height: 58,
    minWidth: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  fabWide: { paddingHorizontal: 20 },
  fabText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 16 },
  stat: { flex: 1, paddingVertical: 4 },
  statValue: { fontSize: 34, fontFamily: fonts.display, lineHeight: 38 },
  statLabel: { color: colors.muted, fontSize: 13, fontFamily: fonts.medium },
});
