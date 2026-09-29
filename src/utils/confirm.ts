import { Platform } from 'react-native';
import { useDialog } from '@/components/AppDialog';

/** Pede confirmação antes de uma ação destrutiva (funciona no app e na web). */
export function confirm(title: string, message: string, onConfirm: () => void, confirmText = 'Excluir') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  useDialog.getState().open({
    title,
    message,
    actions: [
      { text: 'Cancelar', variant: 'ghost' },
      { text: confirmText, variant: 'danger', onPress: onConfirm },
    ],
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  useDialog.getState().open({ title, message, actions: [{ text: 'OK' }] });
}

/** Menu de opções (ex.: "Tirar foto" / "Escolher da galeria"). Na web vira uma lista numerada. */
export function choose(title: string, options: { text: string; onPress: () => void; destructive?: boolean }[]) {
  if (Platform.OS === 'web') {
    const answer = window.prompt(`${title}\n\n${options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')}\n\nDigite o número:`);
    const picked = options[Number(answer) - 1];
    picked?.onPress();
    return;
  }
  useDialog.getState().open({
    title,
    actions: [
      ...options.map((o) => ({ text: o.text, onPress: o.onPress, variant: o.destructive ? ('danger' as const) : ('secondary' as const) })),
      { text: 'Cancelar', variant: 'ghost' as const },
    ],
  });
}
