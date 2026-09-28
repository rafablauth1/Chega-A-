import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts } from '@/theme';
import { checkPassword, passwordRules, STRENGTH } from '@/utils/password';
import { buildIso } from '@/utils/format';

/** Campo de senha com botão de mostrar/esconder. */
export function PasswordField({ label, style, ...props }: TextInputProps & { label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={{ color: colors.muted, fontSize: 14, fontFamily: fonts.medium, marginBottom: 6 }}>{label}</Text>}
      <View>
        <TextInput
          placeholderTextColor={colors.muted + '99'}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={72}
          style={[
            {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingLeft: 14,
              paddingRight: 48,
              paddingVertical: 12,
              color: colors.chalk,
              fontSize: 16,
              fontFamily: fonts.body,
            },
            style,
          ]}
          {...props}
        />
        <Pressable
          onPress={() => setShow((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={show ? 'Esconder senha' : 'Mostrar senha'}
          style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
        >
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

/** Barrinha de força + lista de exigências, cada uma com ✓ quando cumprida. */
export function PasswordChecklist({ password, email, name }: { password: string; email?: string; name?: string }) {
  if (!password) return null;
  const rules = passwordRules(password);
  const check = checkPassword(password, { email, name });
  const s = STRENGTH[check.score];
  return (
    <View style={{ marginTop: -8, marginBottom: 16, gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= Math.max(check.score, 1) ? s.color : colors.border }} />
        ))}
      </View>
      <Text style={{ color: s.color, fontFamily: fonts.semibold, fontSize: 13 }}>Senha {s.label.toLowerCase()}</Text>
      {rules.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={r.ok ? colors.success : colors.muted} />
          <Text style={{ color: r.ok ? colors.text : colors.muted, fontFamily: fonts.body, fontSize: 13 }}>{r.label}</Text>
        </View>
      ))}
      {rules.every((r) => r.ok) && check.problem && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} />
          <Text style={{ color: colors.warning, fontFamily: fonts.body, fontSize: 13, flex: 1 }}>{check.problem}</Text>
        </View>
      )}
    </View>
  );
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (ou null se inválida ou no futuro). */
export function birthToIso(br: string): string | null {
  const iso = buildIso(br, '00:00')?.slice(0, 10) ?? null;
  if (!iso || iso > new Date().toISOString().slice(0, 10) || iso < '1900-01-01') return null;
  return iso;
}
