/**
 * Gera o "Pix copia e cola" (BR Code estático) do padrão do Banco Central.
 * Funciona com qualquer banco, sem taxa e sem integração.
 */

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Remove acentos e caracteres fora do ASCII (exigência do BR Code). */
const ascii = (s: string, max: number) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,@+\-_/]/g, '')
    .trim()
    .slice(0, max);

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede a especificação do Pix. */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Normaliza a chave: celular vira +55..., CPF/CNPJ só dígitos, e-mail e aleatória como estão. */
export function normalizeKey(key: string) {
  const k = key.trim();
  if (k.includes('@')) return k.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  if (k.startsWith('+')) return '+' + k.replace(/\D/g, '');
  const digits = k.replace(/\D/g, '');
  // (11) 99999-9999 digitado com formatação de telefone
  if (/[()\s-]/.test(k) && (digits.length === 10 || digits.length === 11) && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)) {
    return '+55' + digits;
  }
  return digits || k;
}

export function pixPayload({
  key,
  name,
  city,
  amount,
  message,
}: {
  key: string;
  name: string;
  city: string;
  amount?: number;
  message?: string;
}) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', normalizeKey(key)) + (message ? field('02', ascii(message, 40)) : '');
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (amount && amount > 0 ? field('54', amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', ascii(name, 25) || 'RECEBEDOR') +
    field('60', ascii(city, 15) || 'BRASIL') +
    field('62', field('05', '***')) +
    '6304';
  return body + crc16(body);
}
