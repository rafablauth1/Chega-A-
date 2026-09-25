import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { POSITIONS, SKILLS, type Player } from '../types';
import { initials } from '../utils/format';
import { displayName } from '../utils/names';

/** Converte nota 1–5 para a escala 40–99 dos cards de videogame. */
export const toOvr = (r: number) => Math.round(40 + ((Math.min(5, Math.max(1, r)) - 1) / 4) * 59);

const TIERS = {
  ouro: { bg: '#E8C766', edge: '#B8912F', dark: '#3D2E07', label: 'OURO' },
  prata: { bg: '#D5DADF', edge: '#9AA3AB', dark: '#23292E', label: 'PRATA' },
  bronze: { bg: '#D59A6A', edge: '#9C6437', dark: '#3A220E', label: 'BRONZE' },
};

const ABBR: Record<string, string> = { tecnica: 'TEC', fisico: 'FIS', passe: 'PAS', finalizacao: 'FIN', defesa: 'DEF' };

export const tierOf = (ovr: number) => (ovr >= 75 ? TIERS.ouro : ovr >= 60 ? TIERS.prata : TIERS.bronze);

interface Props {
  player: Player;
  overall: number;
  groupName: string;
  extra?: { goals: number; games: number; mvps: number };
}

/** Card do jogador. É um forwardRef para poder virar imagem (react-native-view-shot). */
export const PlayerCard = forwardRef<View, Props>(function PlayerCard({ player, overall, groupName, extra }, ref) {
  const ovr = toOvr(overall);
  const tier = tierOf(ovr);
  const pos = POSITIONS.find((p) => p.key === player.position)?.label ?? player.position;

  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: tier.bg, borderColor: tier.edge }]}>
        {/* brilho diagonal */}
        <View style={[styles.shine, { backgroundColor: '#ffffff' }]} />

        <View style={styles.top}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.ovr, { color: tier.dark }]}>{ovr}</Text>
            <Text style={[styles.pos, { color: tier.dark }]}>{player.position}</Text>
            <View style={[styles.divider, { backgroundColor: tier.dark }]} />
            <Text style={[styles.tier, { color: tier.dark }]}>{tier.label}</Text>
          </View>
          <View style={[styles.photo, { borderColor: tier.edge, backgroundColor: tier.dark + '22' }]}>
            <Text style={[styles.photoText, { color: tier.dark }]}>{initials(player.name)}</Text>
          </View>
        </View>

        <Text style={[styles.name, { color: tier.dark }]} numberOfLines={1}>
          {displayName(player).toUpperCase()}
        </Text>
        <Text style={[styles.sub, { color: tier.dark }]}>{pos}</Text>
        <View style={[styles.line, { backgroundColor: tier.dark }]} />

        <View style={styles.stats}>
          {SKILLS.map((s) => (
            <View key={s.key} style={styles.stat}>
              <Text style={[styles.statValue, { color: tier.dark }]}>{toOvr(player.skills[s.key])}</Text>
              <Text style={[styles.statLabel, { color: tier.dark }]}>{ABBR[s.key]}</Text>
            </View>
          ))}
        </View>

        {extra && (
          <>
            <View style={[styles.line, { backgroundColor: tier.dark }]} />
            <View style={styles.stats}>
              <Extra label="JOGOS" value={extra.games} color={tier.dark} />
              <Extra label="GOLS" value={extra.goals} color={tier.dark} />
              <Extra label="CRAQUE" value={extra.mvps} color={tier.dark} />
            </View>
          </>
        )}

        <Text style={[styles.footer, { color: tier.dark }]} numberOfLines={1}>
          ⚽ {groupName}
        </Text>
      </View>
    </View>
  );
});

function Extra({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8, backgroundColor: 'transparent' },
  card: {
    width: 260,
    borderRadius: 22,
    borderWidth: 4,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  shine: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 160,
    height: 420,
    opacity: 0.18,
    transform: [{ rotate: '35deg' }],
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ovr: { fontSize: 52, fontWeight: '900', lineHeight: 56 },
  pos: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  divider: { width: 26, height: 2, marginVertical: 6, opacity: 0.5 },
  tier: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, opacity: 0.8 },
  photo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { fontSize: 48, fontWeight: '900' },
  name: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 12, letterSpacing: 1 },
  sub: { fontSize: 12, fontWeight: '700', textAlign: 'center', opacity: 0.75 },
  line: { height: 1.5, opacity: 0.35, marginVertical: 10 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 40 },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, opacity: 0.8 },
  footer: { fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 12, opacity: 0.7 },
});
