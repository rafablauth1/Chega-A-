import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, Text, View } from 'react-native';
import { Button, text } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { downloadApk, downloadedApk, installApk, type DownloadProgress } from '@/utils/apkInstaller';
import { checkForUpdate, dismissUpdate, installedVersionName, type AppRelease } from '@/utils/appUpdate';

/**
 * Atualizações, em dois tipos:
 *  - AUTOMÁTICA (telas, regras, correções): baixa sozinha pelo expo-updates; aqui aparece
 *    "Atualização pronta · Reiniciar" (ou aplica sozinha na próxima vez que o app abrir).
 *  - APK NOVO (mudança nativa): janela "Nova versão disponível". O app baixa o APK do GitHub
 *    com barra de progresso e abre o "Instalar" do Android. Se der errado, oferece o navegador.
 * Confere ao abrir o app e ao voltar para ele (no máximo 1x a cada 30 min).
 */

type Release = AppRelease & { mandatory: boolean };
type Phase = { step: 'idle' } | { step: 'downloading'; p: DownloadProgress } | { step: 'ready'; uri: string } | { step: 'error' };

const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1048576))} MB`;

export function UpdatePrompt() {
  const [release, setRelease] = useState<Release | null>(null);
  const [otaReady, setOtaReady] = useState(false);
  const [otaHidden, setOtaHidden] = useState(false);

  useEffect(() => {
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 30 * 60 * 1000) return;
      last = Date.now();
      // Sem internet volta null: não fecha a janela (nem um download) que já está aberta
      checkForUpdate().then((r) => r && setRelease((prev) => prev ?? r));
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
        <NewVersionModal
          release={release}
          onClose={() => {
            dismissUpdate(release.versionCode);
            setRelease(null);
          }}
        />
      )}
    </>
  );
}

function NewVersionModal({ release, onClose }: { release: Release; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const cancelRef = useRef<(() => void) | null>(null);

  // Já baixou antes e fechou o instalador? Vai direto para "Instalar"
  useEffect(() => {
    downloadedApk(release).then((uri) => uri && setPhase({ step: 'ready', uri }));
    return () => cancelRef.current?.();
  }, [release]);

  const install = (uri: string) => installApk(uri).catch(() => setPhase({ step: 'error' }));

  const start = () => {
    const { done, cancel } = downloadApk(release, (p) => setPhase({ step: 'downloading', p }));
    cancelRef.current = cancel;
    setPhase({ step: 'downloading', p: { written: 0, total: release.sizeBytes ?? 0 } });
    done
      .then((uri) => {
        setPhase({ step: 'ready', uri });
        install(uri);
      })
      // Cancelou (stop já limpou o ref): volta ao início; qualquer outro problema: oferece o navegador
      .catch(() => setPhase(cancelRef.current ? { step: 'error' } : { step: 'idle' }))
      .finally(() => {
        cancelRef.current = null;
      });
  };

  const stop = () => {
    const cancel = cancelRef.current;
    cancelRef.current = null;
    cancel?.();
    setPhase({ step: 'idle' });
  };

  const busy = phase.step === 'downloading';
  const canClose = !release.mandatory && !busy;
  const pct = phase.step === 'downloading' && phase.p.total > 0 ? Math.min(100, Math.round((phase.p.written / phase.p.total) * 100)) : 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={canClose ? onClose : () => {}}>
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

          {phase.step === 'idle' && (
            <>
              <Text style={[text.muted, { fontSize: 13 }]}>
                Esta versão traz peças novas, por isso baixa o app completo
                {release.sizeBytes ? ` (${mb(release.sizeBytes)})` : ''}. Prefira o Wi-Fi. Seus dados e seu login continuam.
              </Text>
              <Button title="Atualizar" icon="download" onPress={start} />
            </>
          )}

          {phase.step === 'downloading' && (
            <>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.primary }} />
              </View>
              <Text style={text.muted}>
                Baixando… {pct}%{phase.p.total > 0 ? ` (${mb(phase.p.written)} de ${mb(phase.p.total)})` : ''}
              </Text>
              <Button title="Cancelar" variant="ghost" onPress={stop} />
            </>
          )}

          {phase.step === 'ready' && (
            <>
              <Text style={[text.muted, { fontSize: 13 }]}>
                Baixado. Toque em Instalar e confirme na tela do Android. Se ele pedir para permitir apps desta fonte, toque em
                Configurações, ligue a opção e volte.
              </Text>
              <Button title="Instalar" icon="checkmark-circle" onPress={() => install(phase.uri)} />
            </>
          )}

          {phase.step === 'error' && (
            <>
              <Text style={[text.body, { color: colors.warning }]}>
                Não deu para baixar aqui. Tente de novo ou baixe pelo navegador.
              </Text>
              <Button title="Tentar de novo" icon="refresh" onPress={start} />
              <Button title="Baixar pelo navegador" variant="secondary" icon="open-outline" onPress={() => Linking.openURL(release.url)} />
            </>
          )}

          {canClose && <Button title="Agora não" variant="ghost" onPress={onClose} />}
        </View>
      </View>
    </Modal>
  );
}
