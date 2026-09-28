import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, Text, View } from 'react-native';
import { Button, text } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { checkForUpdate, dismissUpdate, installedVersionName, type AppRelease } from '@/utils/appUpdate';

/** Janela "Nova versão disponível". Confere ao abrir o app e ao voltar para ele (no máximo 1x por hora). */
export function UpdatePrompt() {
  const [release, setRelease] = useState<(AppRelease & { mandatory: boolean }) | null>(null);

  useEffect(() => {
    let last = 0;
    const run = () => {
      if (Date.now() - last < 60 * 60 * 1000) return;
      last = Date.now();
      checkForUpdate().then(setRelease);
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, []);

  if (!release) return null;

  const later = () => {
    dismissUpdate(release.versionCode);
    setRelease(null);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={release.mandatory ? () => {} : later}>
      <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 22, gap: 12, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="rocket" size={26} color={colors.primary} />
            <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 24, flex: 1 }}>
              {release.mandatory ? 'Atualização obrigatória' : 'Nova versão disponível'}
            </Text>
          </View>
          <Text style={text.muted}>
            Você está na {installedVersionName()}. A versão {release.versionName} já saiu
            {release.mandatory ? ' e traz uma correção importante: atualize para continuar usando.' : '.'}
          </Text>
          {!!release.notes?.length && (
            <View style={{ gap: 4 }}>
              {release.notes.slice(0, 5).map((n) => (
                <View key={n} style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark" size={16} color={colors.success} style={{ marginTop: 2 }} />
                  <Text style={[text.body, { flex: 1 }]}>{n}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[text.muted, { fontSize: 13 }]}>
            Toque em Atualizar, espere o download e toque em Instalar. Seus dados e seu login continuam.
          </Text>
          <Button title="Atualizar" icon="download" onPress={() => Linking.openURL(release.url)} />
          {!release.mandatory && <Button title="Agora não" variant="ghost" onPress={later} />}
        </View>
      </View>
    </Modal>
  );
}
