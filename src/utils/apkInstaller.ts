import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import type { AppRelease } from './appUpdate';

/**
 * Baixa o APK novo DENTRO do app (com barra de progresso) e abre o instalador do Android.
 * O Android sempre pergunta "Instalar?" e só aceita um APK assinado com a MESMA chave do app
 * instalado, então um arquivo trocado no caminho não instala.
 * Baixa primeiro para ".part" e só renomeia quando termina e confere (tamanho e MD5 de android.json),
 * assim um download interrompido nunca vira um "APK quebrado".
 */

const DIR = `${FileSystem.cacheDirectory}apk-updates/`;
const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export interface DownloadProgress {
  written: number;
  total: number;
}

const finalPath = (r: AppRelease) => `${DIR}VaiaAi-${r.versionCode}.apk`;

async function matches(uri: string, r: AppRelease) {
  const info = await FileSystem.getInfoAsync(uri, { md5: !!r.md5 });
  if (!info.exists) return false;
  if (r.sizeBytes && info.size !== r.sizeBytes) return false;
  if (r.md5 && info.md5?.toLowerCase() !== r.md5.toLowerCase()) return false;
  return true;
}

/** APK desta versão já baixado e conferido (ex.: a pessoa fechou o instalador sem instalar). */
export async function downloadedApk(r: AppRelease): Promise<string | null> {
  const uri = finalPath(r);
  try {
    if (await matches(uri, r)) return uri;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // sem arquivo: baixa de novo
  }
  return null;
}

/** Começa o download; devolve a promessa do arquivo pronto e um jeito de cancelar. */
export function downloadApk(r: AppRelease, onProgress: (p: DownloadProgress) => void) {
  const part = `${finalPath(r)}.part`;
  const task = FileSystem.createDownloadResumable(r.url, part, {}, (p) =>
    onProgress({
      written: p.totalBytesWritten,
      total: p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : (r.sizeBytes ?? 0),
    }),
  );
  const done = (async () => {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    await FileSystem.deleteAsync(part, { idempotent: true });
    const res = await task.downloadAsync();
    if (!res) throw new Error('cancelado');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (!(await matches(part, r))) {
      await FileSystem.deleteAsync(part, { idempotent: true });
      throw new Error('arquivo diferente do esperado');
    }
    await FileSystem.deleteAsync(finalPath(r), { idempotent: true });
    await FileSystem.moveAsync({ from: part, to: finalPath(r) });
    return finalPath(r);
  })();
  return { done, cancel: () => task.cancelAsync().catch(() => {}) };
}

/** Abre a tela "Instalar" do Android para o APK baixado. */
export async function installApk(uri: string) {
  const data = await FileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

/** Depois de atualizado, apaga os APKs antigos (cada um ocupa dezenas de MB). */
export async function clearDownloadedApks() {
  await FileSystem.deleteAsync(DIR, { idempotent: true }).catch(() => {});
}
