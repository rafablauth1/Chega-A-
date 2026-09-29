import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Screen, SectionTitle, text, type IconName } from '@/components/ui';
import { SCORING } from '@/config/scoring';
import { colors, fonts } from '@/theme';

/** Explica em português simples como a pontuação (estilo Cartola) é calculada. Números vêm de config/scoring.ts. */
export default function ScoringHelpScreen() {
  const S = SCORING;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Como funciona a nota' }} />
      <Text style={[text.body, { lineHeight: 22, marginBottom: 16 }]}>
        A pontuação de cada jogador numa pelada é a NOTA da galera multiplicada por três fatores. Muda sozinha se os
        números aqui embaixo mudarem — inclusive nos jogos antigos.
      </Text>

      <Formula
        icon="star"
        title="1. Nota da galera"
        value="0 a 10"
        description={`Depois do jogo, todo mundo vota nos outros. O voto de quem jogou no seu time vale ${S.votes.ownTeamWeight}, e o de quem jogou contra vale ${S.votes.opponentWeight} (adversário costuma ser mais justo). Sem votos suficientes, vale a nota que o organizador deu.`}
      />

      <Formula
        icon="trophy"
        title="2. Resultado"
        value={`× ${S.result.win} / ${S.result.draw} / ${S.result.loss}`}
        description={`Ganhou a partida: ${S.result.win}. Empatou: ${S.result.draw}. Perdeu: ${S.result.loss}. Quando o dia tem várias partidas, entra a média de todas.`}
      />

      <Formula
        icon="football"
        title="3. Scout (gols, assistência e defesa)"
        value={`até × ${S.scout.maxFactor}`}
        description={`Cada gol vale ${S.scout.goal} ponto, cada assistência ${S.scout.assist}. Defesa conta pelos gols sofridos com você em campo (menos gol sofrido, mais pontos). Isso vale mais ou menos dependendo da posição: zagueiro e goleiro ganham mais por defender (e o gol/assistência deles vale mais também); atacante ganha só por atacar; meia fica no meio dos dois. Cada ponto de scout aumenta a nota em ${Math.round(S.scout.factorPerPoint * 100)}%, com teto de × ${S.scout.maxFactor} pra um golaço não distorcer tudo.`}
      />

      <Formula
        icon="ribbon"
        title="4. Craque e bagre do time"
        value={`× ${S.highlight.craque} / × ${S.highlight.bagre}`}
        description={`Depois de calcular tudo acima, quem tirou a maior nota do time vira craque (× ${S.highlight.craque}) e quem tirou a menor vira bagre (× ${S.highlight.bagre}). Só acontece em times com pelo menos ${S.highlight.minTeamSize} jogadores avaliados.`}
      />

      <SectionTitle>E as estrelas do perfil?</SectionTitle>
      <Card>
        <Text style={[text.body, { lineHeight: 22 }]}>
          As habilidades em estrelas (técnica, físico, passe, finalização, defesa) começam pela autoavaliação, mas vão
          se ajustando sozinhas conforme os jogos avaliados chegam — até {S.attributes.gamesForFullWeight} jogos, quando
          o desempenho já pesa o máximo permitido ({Math.round(S.attributes.maxPerformanceWeight * 100)}% do atributo;
          o resto continua vindo da autoavaliação). É essa força que entra no sorteio de times equilibrado.
        </Text>
      </Card>
    </Screen>
  );
}

function Formula({ icon, title, value, description }: { icon: IconName; title: string; value: string; description: string }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[text.title, { flex: 1 }]}>{title}</Text>
        <Text style={{ color: colors.gold, fontFamily: fonts.display, fontSize: 16 }}>{value}</Text>
      </View>
      <Text style={[text.muted, { lineHeight: 20 }]}>{description}</Text>
    </Card>
  );
}
