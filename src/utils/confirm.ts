import { Alert, Platform } from 'react-native';

/** Pede confirmação antes de uma ação destrutiva (funciona no app e na web). */
export function confirm(title: string, message: string, onConfirm: () => void, confirmText = 'Excluir') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Menu de opções (ex.: "Tirar foto" / "Escolher da galeria"). Na web vira uma lista numerada. */
export function choose(title: string, options: { text: string; onPress: () => void; destructive?: boolean }[]) {
  if (Platform.OS === 'web') {
    const answer = window.prompt(`${title}\n\n${options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')}\n\nDigite o número:`);
    const picked = options[Number(answer) - 1];
    picked?.onPress();
    return;
  }
  Alert.alert(title, undefined, [
    ...options.map((o) => ({ text: o.text, onPress: o.onPress, style: o.destructive ? ('destructive' as const) : ('default' as const) })),
    { text: 'Cancelar', style: 'cancel' as const },
  ]);
}
