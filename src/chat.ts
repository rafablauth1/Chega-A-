import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

/** Chat 1 a 1 entre quem deu match (ou vaga do "Falta gente!"). Ver supabase/migrations/008. */

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const PAGE = 50;

/** Mensagens da conversa, da mais nova para a mais antiga (a lista é invertida na tela). */
export async function loadMessages(me: string, other: string, before?: string): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select('*')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(other: string, body: string): Promise<Message> {
  const { data, error } = await supabase.from('messages').insert({ recipient: other, body: body.trim() }).select('*').single();
  if (error) throw error;
  return data as Message;
}

export async function markRead(other: string) {
  await supabase.rpc('mark_read', { other });
}

export async function unreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_count');
  if (error) return 0;
  return (data as number) ?? 0;
}

/** Perfil básico do outro lado da conversa (liberado pelo RLS para quem pode conversar). */
export async function chatPeer(other: string) {
  const { data } = await supabase.from('profiles').select('id, name, nickname, photos, position').eq('id', other).maybeSingle();
  return data as { id: string; name: string; nickname: string | null; photos: string[]; position: string } | null;
}

/**
 * Escuta mensagens novas que chegam para mim. `onMessage` recebe cada uma;
 * devolve a função para parar de escutar.
 */
export function subscribeInbox(me: string, onMessage: (m: Message) => void, onRead?: (m: Message) => void): () => void {
  let channel: RealtimeChannel = supabase
    .channel(`inbox-${me}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${me}` }, (payload) =>
      onMessage(payload.new as Message),
    );
  // Minhas mensagens que o outro leu (para mostrar "Visto")
  if (onRead) {
    channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender=eq.${me}` }, (payload) =>
      onRead(payload.new as Message),
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function chatError(message: string) {
  if (/row-level security|violates|permission/i.test(message)) return 'Vocês não podem mais conversar (o match foi desfeito ou houve bloqueio).';
  if (/Could not find|does not exist|schema cache/i.test(message)) return 'O servidor ainda não tem o chat. Rode a migração 008 no Supabase.';
  if (/network|fetch/i.test(message)) return 'Sem conexão. A mensagem não foi enviada.';
  return message;
}

/** "14:32" hoje, "ontem", ou "12/09" */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === yesterday.toDateString()) return 'ontem';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
