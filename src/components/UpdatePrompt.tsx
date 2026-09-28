import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, Pressable, Text, View } from 'react-native';
import { Button, text } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { checkForUpdate, dismissUpdate, installedVersionName, type AppRelease } from '@/utils/appUpdate';

/**
 * Atualizações, em dois tipos:
 *  - AUTOMÁTICA (telas, regras, correções): baixa sozinha pelo expo-updates; aqui aparece
 *    "Atualização pronta · Reiniciar" (ou aplica sozinha na próxima vez que o app abrir).
 *  - APK NOVO (mudança nativa): janela "Nova versão disponível" com o link do GitHub.
 * Confere ao abrir o app e ao voltar para ele (no máximo 1x a cada 30 min).
 */
export function UpdatePrompt() {
  const [release, setRelease] = useState<(AppRelease & { mandatory: boolean }) | null>(null);
  const [otaReady, setOtaReady] = useState(false);
  const [otaHidden, setOtaHidden] = useState(false);

  useEffect(() => {
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 30 * 60 * 1000) return;
      last = Date.now();
      checkForUpdate().then(setRelease);
      if (!Updates.isEnabled || __DEV__) return;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          const res = await Updates.fetchUpdateAsync();
          if (res.isNew) setOtaReady(true);
        }
      } catch {
        // sem internet ou atualização recusada (assinatura inválida): segue na versão atual
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, []);

  return (
    <>
      {otaReady && !otaHidden && !release && (
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 90,
            zIndex: 100,
            backgroundColor: colors.cardAlt,
            borderColor: colors.primary,
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <Text style={[text.body, { flex: 1 }]}>Atualização pronta. Reinicie para usar as novidades.</Text>
          <Pressable onPress={() => Updates.reloadAsync().catch(() => {})} hitSlop={8}>
            <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>Reiniciar</Text>
          </Pressable>
          <Pressable onPress={() => setOtaHidden(true)} hitSlop={8} accessibilityLabel="Depois">
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      )}

      {release && (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={
            release.mandatory
              ? () => {}
              : () => {
                  dismissUpdate(release.versionCode);
                  setRelease(null);
                }
          }
        >
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
              {!release.mandatory && (
                <Button
                  title="Agora não"
                  variant="ghost"
                  onPress={() => {
                    dismissUpdate(release.versionCode);
                    setRelease(null);
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
