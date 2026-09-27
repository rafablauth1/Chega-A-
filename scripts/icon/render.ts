/**
 * Gera os PNGs do ícone a partir de scripts/icon/icon.html com o Edge/Chrome em modo headless.
 * Rodar da raiz do projeto: node scripts/icon/render.ts
 * (BROWSER=caminho/do/chrome para usar outro navegador)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = process.env.BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const font = readFileSync('node_modules/@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf');
const html = readFileSync('scripts/icon/icon.html', 'utf8').replace(
  'FONT_URL',
  `data:font/ttf;base64,${font.toString('base64')}`,
);

const dir = mkdtempSync(join(tmpdir(), 'vaia-icon-'));
const page = join(dir, 'icon.html');
writeFileSync(page, html);

const variants: [string, string][] = [
  ['full', 'icon.png'],
  ['fg', 'android-icon-foreground.png'],
  ['bg', 'android-icon-background.png'],
  ['mono', 'android-icon-monochrome.png'],
  ['splash', 'splash-icon.png'],
];

for (const [v, file] of variants) {
  const out = resolve('assets', file);
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      '--window-size=1024,1024',
      '--virtual-time-budget=5000',
      `--screenshot=${out}`,
      `${pathToFileURL(page).href}?v=${v}`,
    ],
    { stdio: 'ignore' },
  );
  console.log(out);
}
