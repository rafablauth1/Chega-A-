import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth';
import { chatError, chatPeer, chatTime, loadMessages, markRead, sendMessage, subscribeInbox, type Message } from '@/chat';
import { Avatar } from '@/components/ui';
import { REPORT_REASONS, block, discoveryError, report } from '@/discovery';
import { colors, fonts, positionColors } from '@/theme';
import { choose, confirm, notify } from '@/utils/confirm';

export default function ChatScreen() {
  const { id: other, name: nameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const insets = useSafeAreaInsets();
  const [peer, setPeer] = useState<{ name: string; nickname: string | null; photos: string[]; position: string } | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [end, setEnd] = useState(false);
  const loadingMore = useRef(false);

  const display = peer?.nickname || peer?.name || nameParam || 'Conversa';

  useEffect(() => {
    if (!me || !other) return;
    chatPeer(other).then(setPeer).catch(() => {});
    loadMessages(me, other)
      .then((list) => {
        setMessages(list);
        setEnd(list.length < 50);
        markRead(other);
      })
      .catch((e) => {
        setMessages([]);
        notify('Não deu para abrir a conversa', chatError(e.message));
      });
    // Mensagem nova do outro chega na hora
    return subscribeInbox(
      me,
      (m) => {
        if (m.sender !== other) return;
        setMessages((cur) => (cur && !cur.some((x) => x.id === m.id) ? [m, ...cur] : cur));
        markRead(other);
      },
      (m) => setMessages((cur) => cur?.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)) ?? cur),
    );
  }, [me, other]);

  const loadOlder = useCallback(async () => {
    if (end || loadingMore.current || !messages?.length) return;
    loadingMore.current = true;
    try {
      const older = await loadMessages(me, other, messages[messages.length - 1].created_at);
      setMessages((cur) => [...(cur ?? []), ...older]);
      if (older.length < 50) setEnd(true);
    } finally {
      loadingMore.current = false;
    }
  }, [end, messages, me, other]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(other, body);
      setMessages((cur) => [m, ...(cur ?? [])]);
      setDraft('');
    } catch (e: any) {
      notify('Mensagem não enviada', chatError(e.message));
    } finally {
      setSending(false);
    }
  };

  const menu = () =>
    choose(display, [
      { text: 'Ver perfil', onPress: () => router.push({ pathname: '/athlete/[id]', params: { id: other } }) },
      {
        text: 'Bloquear',
        destructive: true,
        onPress: () =>
          confirm('Bloquear', `${display} não vai mais te ver nem te mandar mensagem.`, () =>
            block(other).then(() => router.back()).catch((e) => notify('Não deu certo', discoveryError(e.message))),
          'Bloquear'),
      },
      {
        text: 'Denunciar',
        destructive: true,
        onPress: () =>
          choose(
            `Denunciar ${display}`,
            REPORT_REASONS.map((r) => ({
              text: r.label,
              onPress: async () => {
                try {
                  // Manda as últimas mensagens dele junto, para a análise
                  const theirs = (messages ?? []).filter((m) => m.sender === other).slice(0, 5).map((m) => m.body).join(' | ');
                  await report({ user: other, reason: r.key, details: theirs.slice(0, 500) });
                  await block(other);
                  notify('Denúncia enviada', 'Obrigado. Vamos analisar, e vocês não vão mais se ver.');
                  router.back();
                } catch (e: any) {
                  notify('Não deu certo', discoveryError(e.message));
                }
              },
            })),
          ),
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: other } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={display} photo={peer?.photos?.[0]} size={34} color={positionColors[peer?.position ?? 'MEI']} />
              <Text style={{ color: colors.chalk, fontFamily: fonts.display, fontSize: 22 }} numberOfLines={1}>
                {display}
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={menu} hitSlop={10} style={{ marginRight: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.chalk} />
            </Pressable>
          ),
        }}
      />

      {messages === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            end ? (
              <View style={styles.safety}>
                <Text style={{ fontSize: 28 }}>⚽</Text>
                <Text style={styles.safetyTitle}>Combinem o fute por aqui</Text>
                <Text style={styles.safetyText}>
                  Marquem em quadras e lugares públicos. Não pague nada adiantado a desconhecidos. Se algo parecer estranho, toque
                  em ⋮ para denunciar ou bloquear.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const mine = item.sender === me;
            const older = messages[index + 1];
            const showTime = !older || new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > 10 * 60 * 1000;
            return (
              <View>
                {showTime && <Text style={styles.time}>{chatTime(item.created_at)}</Text>}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.body, mine && { color: colors.onPrimary }]}>{item.body}</Text>
                  {mine && index === 0 && (
                    <Text style={styles.status}>{item.read_at ? 'Visto' : 'Enviado'}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Mensagem"
          placeholderTextColor={colors.muted + '99'}
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable onPress={send} disabled={!draft.trim() || sending} style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}>
          <Ionicons name="send" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  body: { color: colors.chalk, fontFamily: fonts.body, fontSize: 16, lineHeight: 21 },
  status: { color: colors.onPrimary, opacity: 0.7, fontFamily: fonts.medium, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  time: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center', marginVertical: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.chalk,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  safety: { alignItems: 'center', padding: 20, marginBottom: 12, backgroundColor: colors.card, borderRadius: 18, gap: 6 },
  safetyTitle: { color: colors.chalk, fontFamily: fonts.display, fontSize: 22 },
  safetyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
