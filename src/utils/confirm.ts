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
