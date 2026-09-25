import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Button, Card, Check, Empty, Input, Screen, SectionTitle, Stat, Tag, text } from '@/components/ui';
import { useStore } from '@/store';
import { colors } from '@/theme';
import type { Player } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { formatShortDate, money, monthKey, monthLabel, parseMoney, shiftMonth, todayIso } from '@/utils/format';

const displayName = (p: Player) => p.nickname || p.name;

export default function FinanceScreen() {
  const players = useStore((s) => s.players);
  const games = useStore((s) => s.games);
  const expenses = useStore((s) => s.expenses);
  const monthly = useStore((s) => s.monthly);
  const fee = useStore((s) => s.settings.monthlyFee);
  const { toggleMonthly, togglePaid, addExpense, removeExpense } = useStore.getState();

  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const isAvulso = (id: string) => byId[id]?.type === 'avulso';

  // ---- Entradas e saídas
  const gameIncome = (gs: typeof games) =>
    gs.reduce((sum, g) => sum + g.paid.filter(isAvulso).length * g.pricePerPlayer, 0);
  const monthGames = games.filter((g) => g.date.startsWith(month));
  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const monthIn = gameIncome(monthGames) + (monthly[month]?.length ?? 0) * fee;
  const monthOut = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const totalMonthly = Object.values(monthly).reduce((s, ids) => s + ids.length, 0) * fee;
  const balance = gameIncome(games) + totalMonthly - expenses.reduce((s, e) => s + e.amount, 0);

  // ---- Mensalistas do mês
  const mensalistas = players
    .filter((p) => p.type === 'mensalista' && (p.active || monthly[month]?.includes(p.id)))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const paidMonthly = mensalistas.filter((p) => monthly[month]?.includes(p.id));

  // ---- Avulsos devendo (todos os jogos)
  const debts = games
    .flatMap((g) =>
      g.attendees
        .filter((id) => isAvulso(id) && !g.paid.includes(id))
        .map((id) => ({ game: g, player: byId[id] })),
    )
    .sort((a, b) => b.game.date.localeCompare(a.game.date));

  const saveExpense = () => {
    const value = parseMoney(amount);
    if (!desc.trim() || value <= 0) return notify('Preencha a descrição e o valor da despesa');
    addExpense({ description: desc.trim(), amount: value, date: month === current ? todayIso() : `${month}-01` });
    setDesc('');
    setAmount('');
  };

  const charge = () => {
    const lines = [
      ...mensalistas.filter((p) => !paidMonthly.includes(p)).map((p) => `• ${displayName(p)} - mensalidade ${monthLabel(month)} (${money(fee)})`),
      ...debts.map((d) => `• ${displayName(d.player)} - jogo ${formatShortDate(d.game.date)} (${money(d.game.pricePerPlayer)})`),
    ];
    if (!lines.length) return notify('Ninguém devendo! 🎉');
    Share.share({ message: `💰 Pendências da pelada\n\n${lines.join('\n')}` });
  };

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={text.muted}>Saldo em caixa</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: balance >= 0 ? colors.primary : colors.danger }}>
          {money(balance)}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={text.title}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <Stat label="Entradas" value={money(monthIn)} color={colors.primary} />
        <Stat label="Saídas" value={money(monthOut)} color={colors.danger} />
      </View>

      <Button title="Cobrar pendentes" icon="logo-whatsapp" variant="secondary" onPress={charge} />

      {/* Mensalidades */}
      <SectionTitle right={<Text style={text.muted}>{paidMonthly.length}/{mensalistas.length} · {money(fee)}</Text>}>
        Mensalidades
      </SectionTitle>
      {mensalistas.length === 0 ? (
        <Card>
          <Text style={text.muted}>Nenhum mensalista. Marque jogadores como mensalista no cadastro.</Text>
        </Card>
      ) : (
        <Card>
          {mensalistas.map((p) => {
            const paid = monthly[month]?.includes(p.id) ?? false;
            return (
              <Pressable
                key={p.id}
                onPress={() => toggleMonthly(month, p.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
              >
                <Check checked={paid} />
                <Text style={[text.body, { flex: 1 }]}>{displayName(p)}</Text>
                <Tag label={paid ? 'PAGO' : 'ABERTO'} color={paid ? colors.primary : colors.danger} />
              </Pressable>
            );
          })}
        </Card>
      )}

      {/* Avulsos devendo */}
      <SectionTitle right={<Text style={text.muted}>{money(debts.reduce((s, d) => s + d.game.pricePerPlayer, 0))}</Text>}>
        Avulsos a receber
      </SectionTitle>
      {debts.length === 0 ? (
        <Card>
          <Text style={text.muted}>Nenhum avulso devendo. ✅</Text>
        </Card>
      ) : (
        <Card>
          {debts.map(({ game, player }) => (
            <Pressable
              key={game.id + player.id}
              onPress={() => togglePaid(game.id, player.id)}
              onLongPress={() => router.push(`/game/${game.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
            >
              <Check checked={false} />
              <View style={{ flex: 1 }}>
                <Text style={text.body}>{displayName(player)}</Text>
                <Text style={text.muted}>Jogo de {formatShortDate(game.date)}</Text>
              </View>
              <Text style={{ color: colors.warning, fontWeight: '700' }}>{money(game.pricePerPlayer)}</Text>
            </Pressable>
          ))}
          <Text style={[text.muted, { marginTop: 6, fontSize: 12 }]}>Toque para marcar como pago.</Text>
        </Card>
      )}

      {/* Despesas */}
      <SectionTitle>Despesas do mês</SectionTitle>
      <Card>
        {monthExpenses.length === 0 && <Text style={[text.muted, { marginBottom: 10 }]}>Nenhuma despesa lançada.</Text>}
        {monthExpenses.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={text.body}>{e.description}</Text>
              <Text style={text.muted}>{formatShortDate(e.date)}</Text>
            </View>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>-{money(e.amount)}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => confirm('Excluir despesa', `Remover "${e.description}"?`, () => removeExpense(e.id))}
            >
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 3 }}>
            <Input placeholder="Ex.: Aluguel da quadra" value={desc} onChangeText={setDesc} />
          </View>
          <View style={{ flex: 2 }}>
            <Input placeholder="R$" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
        </View>
        <Button title="Lançar despesa" icon="remove-circle-outline" variant="secondary" onPress={saveExpense} />
      </Card>

      {players.length === 0 && (
        <Empty icon="wallet-outline" title="Caixa vazio" text="Cadastre jogadores e marque jogos para começar a controlar os pagamentos." />
      )}
    </Screen>
  );
}
