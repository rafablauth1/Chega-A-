import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { notify } from './confirm';

const BUCKET = 'avatars';
const MAX_WIDTH = 1000;

/** Escolhe (ou tira) uma foto, recorta em 4:5 e reduz para ~1000px em JPEG. Devolve o arquivo local. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    notify('Sem permissão', source === 'camera' ? 'Libere o acesso à câmera nas configurações do celular.' : 'Libere o acesso às fotos nas configurações do celular.');
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [4, 5], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets[0]) return null;

  const asset = res.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return saved.uri;
}

/** Envia para a pasta do usuário no Supabase e devolve a URL pública. */
export async function uploadPhoto(userId: string, localUri: string): Promise<string> {
  const body = await (await fetch(localUri)).arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Apaga do armazenamento a foto de uma URL pública (sem erro se já não existir). */
export async function deletePhoto(url: string) {
  const path = url.split(`/${BUCKET}/`)[1];
  if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
}
