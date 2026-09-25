import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../store';
import { colors } from '../theme';
import { money } from '../utils/format';
import { pixPayload } from '../utils/pix';
import { Button, Card, text } from './ui';

/** QR Code + Pix copia e cola do organizador. Sem chave cadastrada, leva aos Ajustes. */
export function PixCard({ amount, message }: { amount?: number; message?: string }) {
  const { pixKey, pixName, pixCity } = useStore((s) => s.settings);
  const [copied, setCopied] = useState(false);

  if (!pixKey) {
    return (
      <Card style={{ gap: 8 }}>
        <Text style={text.title}>💠 Receber por Pix</Text>
        <Text style={text.muted}>Cadastre sua chave Pix nos Ajustes para gerar QR Code e código copia e cola.</Text>
        <Button title="Cadastrar chave Pix" icon="key-outline" variant="secondary" onPress={() => router.push('/settings')} />
      </Card>
    );
  }

  const code = pixPayload({ key: pixKey, name: pixName, city: pixCity, amount, message });

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card style={{ alignItems: 'center', gap: 10 }}>
      <Text style={text.title}>💠 Pix {amount ? `· ${money(amount)}` : ''}</Text>
      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12 }}>
        <QRCode value={code} size={180} />
      </View>
      <Text style={[text.muted, { textAlign: 'center' }]}>
        {pixName || 'Recebedor'} · chave {pixKey}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
        <Button
          title={copied ? 'Copiado!' : 'Copiar código'}
          icon={copied ? 'checkmark' : 'copy-outline'}
          onPress={copy}
          style={{ flex: 1, paddingHorizontal: 8 }}
        />
        <Button
          title="Enviar"
          icon="share-social"
          variant="secondary"
          onPress={() => Share.share({ message: `💠 Pix copia e cola${amount ? ` (${money(amount)})` : ''}:\n\n${code}` })}
          style={{ flex: 1, paddingHorizontal: 8 }}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
        Funciona em qualquer banco. O dinheiro cai direto na sua conta, sem taxa.
      </Text>
    </Card>
  );
}
