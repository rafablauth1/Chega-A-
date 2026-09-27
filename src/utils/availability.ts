/** Disponibilidade de jogo: dia da semana × turno, guardada como 'seg-noite', 'sab-manha'... */

export const DAYS = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
] as const;

export const PERIODS = [
  { key: 'manha', label: 'Manhã', hint: '6h–12h', icon: 'sunny-outline' },
  { key: 'tarde', label: 'Tarde', hint: '12h–18h', icon: 'partly-sunny-outline' },
  { key: 'noite', label: 'Noite', hint: '18h–24h', icon: 'moon-outline' },
] as const;

export const slotKey = (day: string, period: string) => `${day}-${period}`;

const dayLabel = (k: string) => DAYS.find((d) => d.key === k)?.label ?? k;
const periodLabel = (k: string) => PERIODS.find((p) => p.key === k)?.label.toLowerCase() ?? k;

/** Horários que os dois têm em comum, na ordem da semana. */
export function overlap(a: string[] = [], b: string[] = []) {
  const set = new Set(b);
  return orderSlots(a.filter((s) => set.has(s)));
}

export function orderSlots(slots: string[]) {
  const dayIdx = (s: string) => DAYS.findIndex((d) => s.startsWith(d.key));
  const perIdx = (s: string) => PERIODS.findIndex((p) => s.endsWith(p.key));
  return [...slots].sort((x, y) => dayIdx(x) - dayIdx(y) || perIdx(x) - perIdx(y));
}

/** "qua noite, sáb manhã" (resume dias inteiros: "sáb (o dia todo)") */
export function describeSlots(slots: string[], max = 4) {
  const ordered = orderSlots(slots);
  const byDay = new Map<string, string[]>();
  for (const s of ordered) {
    const [d, p] = s.split('-');
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }
  const parts = [...byDay.entries()].map(([d, ps]) =>
    ps.length === PERIODS.length ? `${dayLabel(d).toLowerCase()} (o dia todo)` : `${dayLabel(d).toLowerCase()} ${ps.map(periodLabel).join(' e ')}`,
  );
  return parts.length > max ? `${parts.slice(0, max).join(', ')} e mais ${parts.length - max}` : parts.join(', ');
}
