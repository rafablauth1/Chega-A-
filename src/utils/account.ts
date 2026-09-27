import { supabase } from '../lib/supabase';

/**
 * Exclui a conta do usuário logado: apaga as fotos do Storage (o SQL não pode),
 * chama a função `delete_my_account` (migração 004) e encerra a sessão.
 */
export async function deleteMyAccount(userId: string) {
  const bucket = supabase.storage.from('avatars');
  const { data: files } = await bucket.list(userId, { limit: 1000 });
  if (files?.length) {
    const { error } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
    if (error) throw error;
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  await supabase.auth.signOut();
}
