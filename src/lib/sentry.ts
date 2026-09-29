import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

/**
 * Relatório de erros (Sentry). Quando o app quebra no celular de alguém, o dono recebe o aviso.
 * Privacidade (LGPD): não manda nome, e-mail, IP, telefone nem localização; não grava tela nem
 * endereços das chamadas ao servidor. Só o erro, a tela e o modelo/sistema do celular.
 * Dados guardados pelo Sentry na União Europeia. Só liga no app instalado (não em desenvolvimento).
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryEnabled = !!dsn && !__DEV__;

if (sentryEnabled) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: true,
    beforeBreadcrumb(b) {
      // Chamadas ao servidor e logs podem carregar ids e textos de usuários: não vão
      if (b.category === 'fetch' || b.category === 'xhr' || b.category === 'console') return null;
      return b;
    },
    beforeSend(event) {
      delete event.user;
      delete event.request;
      if (event.contexts?.device) {
        delete (event.contexts.device as any).name; // "Celular do Fulano"
      }
      return event;
    },
  });
  // Qual pacote de código está rodando (APK original ou atualização automática)
  Sentry.setTag('update_id', Updates.updateId ?? 'embutido');
  Sentry.setTag('runtime', Updates.runtimeVersion ?? 'dev');
}

/** Manda um erro para o Sentry (sem efeito em desenvolvimento ou sem DSN). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
