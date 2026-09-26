import { Text, View } from 'react-native';
import { colors } from '../theme';
import type { Achievement } from '../utils/achievements';
import { SectionTitle, text } from './ui';

export function Achievements({ list }: { list: Achievement[] }) {
  return (
    <>
      <SectionTitle right={<Text style={text.muted}>{list.filter((a) => a.unlocked).length}/{list.length}</Text>}>
        Conquistas
      </SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {list.map((a) => (
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
    </>
  );
}
