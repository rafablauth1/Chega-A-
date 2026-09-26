import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ageOf, type Profile } from '../auth';
import { colors, positionColors } from '../theme';
import { FEET, POSITIONS } from '../types';
import { initials } from '../utils/format';
import { Tag, type IconName } from './ui';

const positionLabel = (key: string | null) => POSITIONS.find((p) => p.key === key)?.label ?? '';

/** Fotos grandes com o nome por cima, estilo app de perfil. Desliza para o lado para ver as outras. */
export function PhotoCarousel({ profile }: { profile: Profile }) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - 32, 520);
  const height = width * 1.25;
  const [index, setIndex] = useState(0);
  const photos = profile.photos ?? [];
  const age = ageOf(profile.birth_date);
  const color = positionColors[profile.position];

  return (
    <View style={[styles.carousel, { width, height }]}>
      {photos.length ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height }} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.noPhoto, { backgroundColor: color + '33' }]}>
          <Text style={{ color, fontSize: width / 4, fontWeight: '900' }}>{initials(profile.name || '?')}</Text>
        </View>
      )}

      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === index && { backgroundColor: '#fff' }]} />
          ))}
        </View>
      )}

      <View style={styles.overlay}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.nickname || profile.name}
          {age !== null && <Text style={{ fontWeight: '400' }}>, {age}</Text>}
        </Text>
        {!!profile.nickname && <Text style={styles.sub}>{profile.name}</Text>}
        {!!profile.city && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location" size={14} color="#fff" />
            <Text style={styles.sub}>{profile.city}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Posições, pé, camisa, bio e medidas. */
export function AthleteInfo({ profile, showContacts }: { profile: Profile; showContacts?: boolean }) {
  const foot = FEET.find((f) => f.key === profile.foot)?.label;
  const facts: { icon: IconName; label: string }[] = [
    profile.height_cm ? { icon: 'resize-outline', label: `${(profile.height_cm / 100).toFixed(2).replace('.', ',')} m` } : null,
    profile.weight_kg ? { icon: 'barbell-outline', label: `${profile.weight_kg} kg` } : null,
    profile.favorite_team ? { icon: 'heart-outline', label: profile.favorite_team } : null,
  ].filter((x): x is { icon: IconName; label: string } => !!x);

  const instagram = profile.instagram?.replace(/^@/, '');
  const phone = profile.phone?.replace(/\D/g, '');

  return (
    <View style={{ gap: 12, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Tag label={positionLabel(profile.position).toUpperCase()} color={positionColors[profile.position]} />
        {profile.second_position && profile.second_position !== profile.position && (
          <Tag label={`TAMBÉM ${positionLabel(profile.second_position).toUpperCase()}`} color={positionColors[profile.second_position]} />
        )}
        {foot && <Tag label={foot.toUpperCase()} color={colors.muted} />}
        {profile.shirt_number !== null && profile.shirt_number !== undefined && (
          <Tag label={`CAMISA ${profile.shirt_number}`} color={colors.gold} />
        )}
      </View>

      {!!profile.bio && <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{profile.bio}</Text>}

      {facts.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {facts.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name={f.icon} size={16} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: '600' }}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}

      {showContacts && (!!phone || !!instagram) && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!!phone && (
            <ContactButton icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${phone.length <= 11 ? '55' + phone : phone}`)} />
          )}
          {!!instagram && (
            <ContactButton icon="logo-instagram" label={`@${instagram}`} onPress={() => Linking.openURL(`https://instagram.com/${instagram}`)} />
          )}
        </View>
      )}
    </View>
  );
}

function ContactButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.contact, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Quanto do perfil está preenchido (0 a 1), para incentivar a completar. */
export function profileCompletion(p: Profile) {
  const checks = [
    p.photos?.length > 0,
    !!p.name,
    !!p.birth_date,
    !!p.city,
    !!p.bio,
    !!p.foot,
    !!p.height_cm,
    !!p.phone,
    p.shirt_number !== null && p.shirt_number !== undefined,
    (p.photos?.length ?? 0) >= 3,
  ];
  return checks.filter(Boolean).length / checks.length;
}

const styles = StyleSheet.create({
  carousel: { alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 40,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.75))',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  name: { color: '#fff', fontSize: 28, fontWeight: '900' },
  sub: { color: '#fff', fontSize: 14, opacity: 0.9 },
  contact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
});
