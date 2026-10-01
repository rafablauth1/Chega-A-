import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { clearDownloadedApks } from './apkInstaller';

/**
 * Aviso de "Nova versão disponível" para quem instalou o APK fora da Play Store.
 * A versão mais nova fica descrita em release/android.json no GitHub (eu atualizo a cada APK novo,
 * com tamanho e MD5 para o app conferir o download; ver apkInstaller.ts).
 * Quando o app estiver na Play Store, a loja atualiza sozinha e este aviso só aparece para quem instalou por fora.
 */

const MANIFEST_URL = 'https://raw.githubusercontent.com/rafablauth1/Chega-A-/main/release/android.json';
/** Só aceita baixar APK do repositório oficial (se alguém adulterar o JSON, não manda o usuário para outro site) */
const TRUSTED_PREFIX = 'https://github.com/rafablauth1/Chega-A-/releases/';
const DISMISS_KEY = 'vaia-ai-update-dismissed';

export interface AppRelease {
  versionCode: number;
  versionName: string;
  url: string;
  notes?: string[];
  /** Versões abaixo desta são obrigadas a atualizar (ex.: correção de segurança) */
  minVersionCode?: number;
  /** Tamanho exato do APK em bytes: mostra "52 MB" e confere o download */
  sizeBytes?: number;
  /** MD5 do APK: confere se o arquivo baixado é exatamente o publicado */
  md5?: string;
}

export const installedVersionCode = (): number => Number(Constants.expoConfig?.android?.versionCode ?? 0);
export const installedVersionName = (): string => Constants.expoConfig?.version ?? '';

/** Devolve a versão nova se houver uma para este celular; null se está em dia (ou sem internet). */
export async function checkForUpdate(): Promise<(AppRelease & { mandatory: boolean }) | null> {
  if (Platform.OS !== 'android' || __DEV__) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const r = (await res.json()) as AppRelease;
    if (typeof r.versionCode !== 'number' || typeof r.url !== 'string' || !r.url.startsWith(TRUSTED_PREFIX)) return null;
    const mine = installedVersionCode();
    if (!mine) return null;
    if (r.versionCode <= mine) {
      clearDownloadedApks(); // já atualizou: libera o espaço do APK baixado
      return null;
    }
    const mandatory = !!r.minVersionCode && mine < r.minVersionCode;
    if (!mandatory) {
      const dismissed = Number(await AsyncStorage.getItem(DISMISS_KEY).catch(() => null));
      if (dismissed === r.versionCode) return null;
    }
    return { ...r, mandatory };
  } catch {
    return null;
  }
}

/** "Agora não": não mostra de novo até sair outra versão. */
export async function dismissUpdate(versionCode: number) {
  await AsyncStorage.setItem(DISMISS_KEY, String(versionCode)).catch(() => {});
}
