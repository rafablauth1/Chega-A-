import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { authStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** Sem URL/chave no .env.local o app continua funcionando só no modo local (sem contas). */
export const isCloudEnabled = !!url && !!key;

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: {
    // Sessão cifrada no cofre do celular (ver secureStorage.ts)
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o token só com o app em primeiro plano (recomendação do Supabase para React Native)
if (isCloudEnabled && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
