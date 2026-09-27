import AsyncStorage from '@react-native-async-storage/async-storage';
import aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Onde a sessão de login fica guardada no celular.
 *
 * A sessão (tokens de acesso) é cifrada com AES-256; a chave de cada item fica no cofre
 * do sistema (Keychain no iPhone, Keystore no Android) via expo-secure-store, e só o texto
 * cifrado vai para o AsyncStorage (o cofre tem limite de tamanho). É o padrão recomendado
 * pelo Supabase para React Native.
 *
 * Sessões antigas, salvas sem cifra antes desta versão, são lidas uma vez e regravadas cifradas.
 * Na web não há cofre: usa o armazenamento do navegador.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    const encryptionKey = await Crypto.getRandomBytesAsync(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }

  private async decrypt(key: string, value: string) {
    const keyHex = await SecureStore.getItemAsync(key);
    if (!keyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(key: string) {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    // Sessão antiga sem cifra (JSON puro): devolve e já regrava cifrada
    if (stored.startsWith('{')) {
      await this.setItem(key, stored).catch(() => {});
      return stored;
    }
    try {
      return await this.decrypt(key, stored);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

export const authStorage = Platform.OS === 'web' ? AsyncStorage : new LargeSecureStore();
