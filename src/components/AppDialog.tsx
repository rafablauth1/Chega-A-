import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { create } from 'zustand';
import { Button, text, type ButtonVariant } from '@/components/ui';
import { colors, fonts } from '@/theme';

export interface DialogAction {
  text: string;
  onPress?: () => void;
  variant?: ButtonVariant;
}

interface DialogState {
  title: string;
  message?: string;
  actions: DialogAction[];
}

interface DialogStore {
  request: DialogState | null;
  open: (req: DialogState) => void;
  close: () => void;
}

/** Fila os popups de confirmar/avisar/escolher com a cara do app (sem cair no branco do sistema). */
export const useDialog = create<DialogStore>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Renderiza no topo do app (junto do UpdatePrompt), uma vez só. */
export function AppDialog() {
  const request = useDialog((s) => s.request);
  const close = useDialog((s) => s.close);
  if (!request) return null;

  const run = (action: DialogAction) => {
    close();
    action.onPress?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 }}
        onPress={close}
      >
        <Pressable
          style={{ backgroundColor: colors.card, borderRadius: 20, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.border, maxHeight: '80%' }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 22 }}>{request.title}</Text>
            {!!request.message && <Text style={text.muted}>{request.message}</Text>}
          </View>
          <ScrollView style={{ flexGrow: 0 }}>
            <View style={{ gap: 10 }}>
              {request.actions.map((a, i) => (
                <Button key={i} title={a.text} variant={a.variant ?? 'secondary'} onPress={() => run(a)} />
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
