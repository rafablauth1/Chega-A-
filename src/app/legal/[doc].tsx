import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Empty, Screen, text } from '@/components/ui';
import { LEGAL_DOCS, UPDATED_AT } from '@/legal/content';
import { colors } from '@/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: keyof typeof LEGAL_DOCS }>();
  const content = LEGAL_DOCS[doc];

  if (!content) {
    return (
      <Screen>
        <Empty icon="document-text-outline" title="Documento não encontrado" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: content.title }} />
      <Text style={[text.body, { lineHeight: 22, marginBottom: 8 }]}>{content.intro}</Text>
      <Text style={[text.muted, { marginBottom: 8 }]}>Atualizado em {UPDATED_AT}</Text>

      {content.sections.map((s) => (
        <View key={s.heading} style={{ marginTop: 18 }}>
          <Text style={[text.title, { fontSize: 18, marginBottom: 8, color: colors.text }]}>{s.heading}</Text>
          {s.paragraphs?.map((p, i) => (
            <Text key={i} style={[text.body, { lineHeight: 22, marginBottom: 8, color: colors.muted }]}>
              {p}
            </Text>
          ))}
          {s.items?.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 }}>
              <Text style={[text.body, { color: colors.primary }]}>•</Text>
              <Text style={[text.body, { flex: 1, lineHeight: 22, color: colors.muted }]}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
