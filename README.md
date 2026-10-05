# analise-rodovia

Sistema web que analisa os dados de tráfego dos radares de controle de velocidade da **BR-153 (Transbrasiliana)**,
publicados pela ANTT no Sistema de Informação de Rodovias (`data/volume-radar-trans.csv`).

Todos os números e textos interpretativos são calculados no navegador a partir do CSV — nada é fixado no código.
Se outro arquivo no mesmo formato for carregado (botão **Carregar CSV**), todas as abas se recalculam.

## Abas

| Aba | Conteúdo |
| --- | --- |
| 1. Caracterização do conjunto de dados | Período, equipamentos, rodovia/UF/municípios, tipos de veículo, categorias de velocidade, sentidos e faixas, volume total, lacunas de datas. |
| 2. Tipo de veículo × velocidade | Participação % de cada tipo em cada categoria de velocidade (linhas ≈ 100%), volumes absolutos e interpretação, com destaque para percentuais altos sobre volumes muito pequenos (< 0,1% do total). |
| 3. Distribuição de velocidade por tipo de veículo | Distribuição das velocidades dentro de cada tipo e comparação entre os pontos monitorados (volume, composição, velocidades), com o que pode e o que não pode ser afirmado a partir do arquivo. |
| 4. Variação temporal do tráfego | Média diária por dia da semana (volume ÷ nº de datas daquele dia), transições entre dias, dias úteis × fim de semana, decomposição do aumento por tipo e série mensal. |
| 5. Análise espacial e operacional | Sentidos e faixas (volume, composição, velocidades), ranking de equipamentos acima de 100 km/h em quantidade absoluta e em proporção, e por que diferem. |

Filtros globais: **Período** (completo ou só o intervalo comum a todos os equipamentos) e **Equipamento**.
Também podem ser passados na URL: `index.html?periodo=comum&equip=LE-89#espacial`.

## Como executar

### Direto do disco (sem instalar nada)

Abra `index.html` no navegador. Os dados vêm de `data/dados.js`, que embute o CSV, porque
`fetch()` não funciona em páginas `file://`.

### Com Vite (desenvolvimento)

```bash
npm install
npm run dev       # gera data/dados.js e sobe o servidor do Vite
npm run build     # gera dist/
npm run preview   # serve dist/
```

### Vercel

Importe o repositório; o `vercel.json` já define `npm run build` e a saída `dist/`.

## Estrutura

```
index.html              página única (scripts clássicos com defer)
css/style.css           estilos, com tema claro/escuro automático
js/formatacao.js        números, percentuais e datas em pt-BR
js/leitor.js            leitura do CSV (UTF-8 ou Windows-1252, separador ; ou ,)
js/analise.js           agregações, contexto e paletas de cores
js/graficos.js          gráficos em HTML/SVG puros (sem dependências, funcionam offline)
js/abas.js              cálculo e texto de cada aba
js/app.js               carregamento, filtros e navegação
data/volume-radar-trans.csv   dados originais da ANTT
data/dados.js           CSV embutido em JS (gerado por scripts/gerar-dados.mjs)
vite.config.js          build; copia js/ e data/ para dist/
```

Os scripts são "clássicos" (sem `type="module"`) para funcionar tanto no Vite/Vercel quanto via `file://`.
Como o Vite não empacota scripts clássicos, o `vite.config.js` copia `js/` e `data/` para `dist/`.

Se o CSV for substituído, rode `npm run dados` (ou qualquer `npm run dev`/`build`) para regenerar `data/dados.js`.

## Decisões metodológicas

- **Média diária**: o volume é sempre dividido pelo número de **datas distintas com registro** do recorte, o que neutraliza
  diferenças de cobertura (ex.: LE-89 tem só 150 dias de dados, de jan. a jun. de 2022).
- **Acima de 100 km/h**: categorias cujo limite inferior é maior que 100 (101–120, 121–140, 141–160, > 160 km/h).
- **Volume muito pequeno**: categoria de velocidade com menos de 0,1% do volume total do recorte.
- **Confundimento** detectado automaticamente e explicado na interface: neste arquivo, a faixa 1 só ocorre no sentido
  Crescente (somente LE-60) e a faixa 2 só no Decrescente, então "sentido" e "faixa" não podem ser separados.
