import { router } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Button, Card, Chip, Input, Label, Screen, SectionTitle, text } from '@/components/ui';
import { isCloudEnabled } from '@/lib/supabase';
import { exportData, normalize, useStore } from '@/store';
import { confirm, notify } from '@/utils/confirm';
import { buildDemo } from '@/utils/demo';
import { money, parseMoney } from '@/utils/format';

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const { updateSettings, replaceAll, resetAll } = useStore.getState();

  const [groupName, setGroupName] = useState(settings.groupName);
  const [monthlyFee, setMonthlyFee] = useState(String(settings.monthlyFee).replace('.', ','));
  const [defaultPrice, setDefaultPrice] = useState(String(settings.defaultPrice).replace('.', ','));
  const [defaultLocation, setDefaultLocation] = useState(settings.defaultLocation);
  const [perTeam, setPerTeam] = useState(settings.defaultPlayersPerTeam);
  const [maxPlayers, setMaxPlayers] = useState(String(settings.defaultMaxPlayers));
  const [minutes, setMinutes] = useState(settings.defaultMatchMinutes);
  const [backup, setBackup] = useState('');
  const [pixKey, setPixKey] = useState(settings.pixKey);
  const [pixName, setPixName] = useState(settings.pixName);
  const [pixCity, setPixCity] = useState(settings.pixCity);

  const save = () => {
    updateSettings({
      groupName: groupName.trim() || 'Minha pelada',
      monthlyFee: parseMoney(monthlyFee),
      defaultPrice: parseMoney(defaultPrice),
      defaultLocation: defaultLocation.trim(),
      defaultPlayersPerTeam: perTeam,
      defaultMaxPlayers: parseInt(maxPlayers, 10) || 0,
      defaultMatchMinutes: minutes,
      pixKey: pixKey.trim(),
      pixName: pixName.trim(),
      pixCity: pixCity.trim(),
    });
    router.back();
  };

  const loadDemo = () =>
    confirm(
      'Carregar exemplo',
      'Isso substitui os dados atuais por um grupo fictício com 20 jogadores, jogos, placares e pagamentos.',
      () => {
        replaceAll(buildDemo());
        router.dismissTo('/');
      },
      'Carregar',
    );

  const doExport = () => Share.share({ message: JSON.stringify(exportData()) });

  const doImport = () => {
    try {
      const data = normalize(JSON.parse(backup));
      if (!Array.isArray(data.players)) throw new Error();
      confirm('Importar backup', `Substituir tudo por ${data.players.length} jogadores e ${data.games.length} jogos do backup?`, () => {
        replaceAll(data);
        setBackup('');
        router.dismissTo('/');
      }, 'Importar');
    } catch {
      notify('Backup inválido', 'Cole aqui exatamente o texto exportado pelo app.');
    }
  };

  const wipe = () =>
    confirm('Apagar tudo', 'Remove todos os jogadores, jogos e o financeiro. Não dá para desfazer.', () => {
      resetAll();
      router.dismissTo('/');
    }, 'Apagar tudo');

  return (
    <Screen>
      <Input label="Nome do grupo" value={groupName} onChangeText={setGroupName} />
      <Input label="Mensalidade (R$)" value={monthlyFee} onChangeText={setMonthlyFee} keyboardType="decimal-pad" />
      <Input label="Valor padrão por avulso (R$)" value={defaultPrice} onChangeText={setDefaultPrice} keyboardType="decimal-pad" />
      <Input label="Local padrão" value={defaultLocation} onChangeText={setDefaultLocation} placeholder="Ex.: Arena do Bairro" />
      <Input
        label="Limite de vagas padrão (0 = sem limite)"
        value={maxPlayers}
        onChangeText={(v) => setMaxPlayers(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
      />
      <Label>Jogadores por time (padrão)</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[5, 6, 7, 8, 9, 10, 11].map((n) => (
          <Chip key={n} label={String(n)} selected={perTeam === n} onPress={() => setPerTeam(n)} />
        ))}
      </View>
      <Label>Duração da partida (min)</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[5, 7, 8, 10, 12, 15, 20, 25, 30].map((n) => (
          <Chip key={n} label={String(n)} selected={minutes === n} onPress={() => setMinutes(n)} />
        ))}
      </View>
      <SectionTitle>Pix para receber</SectionTitle>
      <Input
        label="Chave Pix"
        value={pixKey}
        onChangeText={setPixKey}
        placeholder="CPF, e-mail, celular ou chave aleatória"
        autoCapitalize="none"
      />
      <Input label="Nome do recebedor" value={pixName} onChangeText={setPixName} placeholder="Como está no banco" />
      <Input label="Cidade" value={pixCity} onChangeText={setPixCity} placeholder="Ex.: São Paulo" />

      <Text style={[text.muted, { marginBottom: 16 }]}>
        O caixa usa a mensalidade atual ({money(parseMoney(monthlyFee))}) para todos os meses já pagos.
      </Text>
      <Button title="Salvar" icon="checkmark" onPress={save} />

      {!isCloudEnabled && (
        <>
      <SectionTitle>Dados</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Button title="Carregar exemplo (20 jogadores)" icon="flask-outline" variant="secondary" onPress={loadDemo} />
        <Button title="Exportar backup" icon="cloud-upload-outline" variant="secondary" onPress={doExport} />
        <Input
          label="Importar backup"
          value={backup}
          onChangeText={setBackup}
          placeholder="Cole aqui o texto do backup"
          multiline
          style={{ maxHeight: 120 }}
        />
        <Button title="Importar" icon="cloud-download-outline" variant="secondary" onPress={doImport} disabled={!backup.trim()} />
        <Button title="Apagar tudo" icon="trash-outline" variant="danger" onPress={wipe} />
      </Card>
        </>
      )}
    </Screen>
  );
}
