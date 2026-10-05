import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

// Os scripts da aplicação são "clássicos" (sem type="module") para que o
// index.html também funcione aberto direto do disco (file://). O Vite não
// empacota scripts clássicos, então as pastas js/ e data/ são copiadas
// para dist/ ao final do build.
const PASTAS_ESTATICAS = ['js', 'data'];

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'copiar-pastas-estaticas',
      apply: 'build',
      closeBundle() {
        for (const pasta of PASTAS_ESTATICAS) {
          cpSync(resolve(pasta), resolve('dist', pasta), { recursive: true });
        }
      },
    },
  ],
});
