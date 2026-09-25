import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Compartilha um trecho da tela como imagem (WhatsApp, Instagram...).
 * Na web, ou se a captura falhar, compartilha o texto de reserva.
 */
export async function shareView(ref: RefObject<View | null>, fallbackText: string, title = 'Compartilhar') {
  if (Platform.OS !== 'web' && ref.current) {
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
        return;
      }
    } catch {
      // cai para o texto
    }
  }
  await Share.share({ message: fallbackText });
}
