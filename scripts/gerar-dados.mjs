// Converte data/volume-radar-trans.csv em data/dados.js (window.RADAR_CSV),
// permitindo abrir o index.html direto do disco, onde fetch() não funciona.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origem = resolve('data/volume-radar-trans.csv');
const destino = resolve('data/dados.js');

const bytes = readFileSync(origem);
let texto;
try {
  texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
} catch {
  // O arquivo da ANTT é publicado em Windows-1252 / Latin-1.
  texto = bytes.toString('latin1');
}

const literal = texto
  .replace(/\r\n/g, '\n')
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

writeFileSync(
  destino,
  '/* Gerado por scripts/gerar-dados.mjs a partir de data/volume-radar-trans.csv. Nao editar. */\n' +
    'window.RADAR_CSV = `' + literal + '`;\n',
  'utf8'
);
console.log(`dados.js gerado (${(texto.length / 1e6).toFixed(1)} MB de texto)`);
