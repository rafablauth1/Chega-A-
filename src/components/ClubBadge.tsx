import { Text, View } from 'react-native';
import { BRAZILIAN_CLUBS } from '@/data/brazilianClubs';
import { colors, fonts } from '@/theme';

/** Acha o clube da lista pelo nome salvo no perfil (comparação sem acento/maiúscula). */
export function findClub(name?: string | null) {
  if (!name) return null;
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return BRAZILIAN_CLUBS.find((c) => plain(c.name) === plain(name)) ?? null;
}

/**
 * Escudo genérico estilizado (estilo Brasfoot): formato de brasão com a cor do time e a sigla,
 * não o escudo oficial (é marca registrada, precisaria de licença).
 */
export function ClubBadge({ name, size = 28 }: { name?: string | null; size?: number }) {
  if (!name) return null;
  const club = findClub(name);
  const color = club?.color ?? colors.muted;
  const topH = size * 0.62;
  const pointH = size * 0.42;

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: topH,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.22,
          borderTopRightRadius: size * 0.22,
          borderWidth: size * 0.03,
          borderBottomWidth: 0,
          borderColor: '#00000022',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: size * 0.3 }} numberOfLines={1}>
          {club?.abbr ?? name.slice(0, 3).toUpperCase()}
        </Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderTopWidth: pointH,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
          marginTop: -1,
        }}
      />
    </View>
  );
}
