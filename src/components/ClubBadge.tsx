import { Text, View } from 'react-native';
import { BRAZILIAN_CLUBS } from '@/data/brazilianClubs';
import { colors, fonts } from '@/theme';

/** Acha o clube da lista pelo nome salvo no perfil (comparação sem acento/maiúscula). */
export function findClub(name?: string | null) {
  if (!name) return null;
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return BRAZILIAN_CLUBS.find((c) => plain(c.name) === plain(name)) ?? null;
}

/** Selo redondo com a cor do time e a sigla (sem escudo oficial: é marca registrada). */
export function ClubBadge({ name, size = 22 }: { name?: string | null; size?: number }) {
  const club = findClub(name);
  if (!name) return null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: club?.color ?? colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: size * 0.34 }} numberOfLines={1}>
        {club?.abbr ?? name.slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}
