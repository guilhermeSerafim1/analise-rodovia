/* Gráficos em HTML/SVG puros, sem dependências externas (funcionam offline). */
(function () {
  const R = (window.Radar = window.Radar || {});
  const F = R.fmt;
  const G = (R.graficos = {});

  /** Tinta legível sobre uma cor de preenchimento. */
  function tintaSobre(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.36 ? '#0b0b0b' : '#ffffff';
  }

  const attr = (s) => F.esc(s);

  G.legenda = (series) =>
    `<div class="legenda">${series
      .map((s) => `<span><i style="background:${s.cor}"></i>${F.esc(s.nome)}</span>`)
      .join('')}</div>`;

  /**
   * Barras horizontais 100% empilhadas.
   * linhas: [{rotulo, sub?, valores:[número por série]}]; series: [{nome, cor}]
   */
  G.barras100 = function (linhas, series, opts = {}) {
    const limiteRotulo = opts.limiteRotulo ?? 9;
    const MINIMO = 0.25; // segmentos menores que isso viram riscos ilegíveis; ficam só na tabela
    let omitidos = 0;
    const corpo = linhas
      .map((l) => {
        const tot = l.valores.reduce((a, b) => a + b, 0);
        const segs = l.valores
          .map((v, i) => {
            if (!v) return '';
            const p = (v / tot) * 100;
            if (p < MINIMO) { omitidos++; return ''; }
            const tip = `<b>${F.esc(l.rotulo)}</b><br>${F.esc(series[i].nome)}: ${F.pa(p)}<br>${F.n(v)} veículos`;
            const rot = p >= limiteRotulo ? `<em style="color:${tintaSobre(series[i].cor)}">${F.p(p, 0)}</em>` : '';
            return `<span class="seg" style="flex:${v} 1 0;background:${series[i].cor}" data-tip="${attr(tip)}">${rot}</span>`;
          })
          .join('');
        return `<div class="b100-linha">
          <div class="b100-rot">${F.esc(l.rotulo)}${l.sub ? `<small>${l.sub}</small>` : ''}</div>
          <div class="b100-barra">${segs || '<span class="vazio">sem registros</span>'}</div>
        </div>`;
      })
      .join('');
    return (
      G.legenda(series) +
      `<div class="b100">${corpo}</div>` +
      (omitidos ? `<p class="nota-grafico">Segmentos com menos de ${F.p(MINIMO, 2)} da barra não são desenhados; os valores estão na tabela.</p>` : '')
    );
  };

  /**
   * Colunas verticais simples (uma série).
   * itens: [{rotulo, valor, texto?, tip?, apagada?}]
   */
  G.colunas = function (itens, cor) {
    const max = Math.max(...itens.map((i) => i.valor), 0) || 1;
    const cols = itens
      .map(
        (i) => `<div class="coluna${i.apagada ? ' apagada' : ''}" data-tip="${attr(i.tip || '')}">
          <div class="valor">${F.esc(i.texto ?? F.n(i.valor))}</div>
          <div class="barra" style="height:${((i.valor / max) * 100).toFixed(2)}%;--cor:${cor}"></div>
        </div>`
      )
      .join('');
    const rots = itens.map((i) => `<div>${F.esc(i.rotulo)}</div>`).join('');
    return `<div class="colunas">${cols}</div><div class="rotulos-colunas">${rots}</div>`;
  };

  /**
   * Barras horizontais simples (uma série, escala própria).
   * itens: [{rotulo, valor, texto, tip?}]
   */
  G.barrasH = function (itens, cor) {
    const max = Math.max(...itens.map((i) => i.valor), 0) || 1;
    return `<div class="barras-h">${itens
      .map(
        (i) => `<div class="bh-linha">
          <div>${F.esc(i.rotulo)}</div>
          <div class="bh-trilho" data-tip="${attr(i.tip || '')}">
            <div class="bh-barra" style="width:calc(${((i.valor / max) * 100).toFixed(2)}% - 90px);background:${cor}"></div>
            <span class="bh-texto">${F.esc(i.texto)}</span>
          </div>
        </div>`
      )
      .join('')}</div>`;
  };

  function passoBonito(max, alvo = 4) {
    const bruto = max / alvo;
    const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    const r = bruto / pot;
    const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
    return m * pot;
  }

  /**
   * Linha temporal (SVG). pontos: [{rotulo, valor|null, tip}]; lacunas (null) interrompem a linha.
   */
  G.linha = function (pontos, opts = {}) {
    const W = 860, H = 260, m = { t: 14, r: 12, b: 30, l: 64 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const vals = pontos.map((p) => p.valor).filter((v) => v != null);
    const passo = passoBonito(Math.max(...vals, 1));
    const ymax = Math.ceil(Math.max(...vals, 1) / passo) * passo;
    const x = (i) => m.l + (pontos.length === 1 ? iw / 2 : (i * iw) / (pontos.length - 1));
    const y = (v) => m.t + ih - (v / ymax) * ih;

    let grade = '';
    for (let v = 0; v <= ymax + 1e-9; v += passo) {
      grade += `<line class="${v === 0 ? 'eixo-linha' : 'grade-linha'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
      grade += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${F.n(v)}</text>`;
    }
    const cadaX = opts.cadaX || Math.max(1, Math.ceil(pontos.length / 10));
    let rotX = '';
    pontos.forEach((p, i) => {
      if (i % cadaX === 0) rotX += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${F.esc(p.rotulo)}</text>`;
    });

    let caminhos = '';
    let atual = [];
    const fecha = () => {
      if (atual.length > 1) caminhos += `<path class="linha-serie" d="M${atual.join('L')}"/>`;
      else if (atual.length === 1) caminhos += `<circle class="ponto" r="3" cx="${atual[0].split(',')[0]}" cy="${atual[0].split(',')[1]}"/>`;
      atual = [];
    };
    pontos.forEach((p, i) => {
      if (p.valor == null) fecha();
      else atual.push(`${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`);
    });
    fecha();

    const larg = iw / Math.max(1, pontos.length - 1);
    const alvos = pontos
      .map((p, i) =>
        p.valor == null
          ? ''
          : `<rect class="alvo" x="${x(i) - larg / 2}" y="${m.t}" width="${larg}" height="${ih}" data-tip="${attr(p.tip || '')}"/>`
      )
      .join('');

    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${attr(opts.titulo || 'Série temporal')}">
      ${grade}${rotX}${caminhos}${alvos}</svg>`;
  };

  /**
   * Faixa linear com os equipamentos posicionados pelo km (SVG).
   * itens: [{id, km, valor, tip}] — área do círculo proporcional ao valor.
   */
  G.faixaKm = function (itens, cor) {
    const W = 860, H = 150, ml = 40, mr = 40, yb = 78;
    const kms = itens.map((i) => i.km).filter(Number.isFinite);
    if (!kms.length) return '<p class="nota-cartao">Sem quilometragem informada.</p>';
    let kmin = Math.min(...kms), kmax = Math.max(...kms);
    const folga = Math.max(2, (kmax - kmin) * 0.06);
    kmin -= folga; kmax += folga;
    const x = (k) => ml + ((k - kmin) / (kmax - kmin)) * (W - ml - mr);
    const vmax = Math.max(...itens.map((i) => i.valor), 1);
    const raio = (v) => 4 + Math.sqrt(v / vmax) * 16;

    const passo = passoBonito(kmax - kmin, 6);
    let marcas = '';
    for (let k = Math.ceil(kmin / passo) * passo; k <= kmax; k += passo) {
      marcas += `<line class="grade-linha" x1="${x(k)}" x2="${x(k)}" y1="${yb - 4}" y2="${yb + 4}"/>`;
      marcas += `<text x="${x(k)}" y="${H - 6}" text-anchor="middle">km ${F.n(k)}</text>`;
    }
    const ordenados = [...itens].filter((i) => Number.isFinite(i.km)).sort((a, b) => a.km - b.km);
    const marcadores = ordenados
      .map((i, idx) => {
        const cima = idx % 2 === 0;
        const r = raio(i.valor);
        const ty = cima ? yb - r - 10 : yb + r + 18;
        return `<g data-tip="${attr(i.tip || '')}">
          <circle cx="${x(i.km)}" cy="${yb}" r="${r + 6}" fill="transparent"/>
          <circle cx="${x(i.km)}" cy="${yb}" r="${r}" fill="${cor}" fill-opacity=".85" stroke="var(--superficie)" stroke-width="2"/>
          <text class="rot-forte" x="${x(i.km)}" y="${ty}" text-anchor="middle">${F.esc(i.id)}</text>
        </g>`;
      })
      .join('');
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posição dos equipamentos ao longo da rodovia">
      <line class="eixo-linha" x1="${ml}" x2="${W - mr}" y1="${yb}" y2="${yb}" stroke-width="3"/>
      ${marcas}${marcadores}</svg>`;
  };

  /* Tooltip único, acionado por qualquer elemento com data-tip. */
  G.iniciarTooltip = function () {
    const tt = document.getElementById('tooltip');
    let alvo = null;
    const posiciona = (ev) => {
      const pad = 14;
      const w = tt.offsetWidth, h = tt.offsetHeight;
      let left = ev.clientX + pad, top = ev.clientY + pad;
      if (left + w > window.innerWidth - 8) left = ev.clientX - w - pad;
      if (top + h > window.innerHeight - 8) top = ev.clientY - h - pad;
      tt.style.left = Math.max(8, left) + 'px';
      tt.style.top = Math.max(8, top) + 'px';
    };
    document.addEventListener('mousemove', (ev) => {
      const el = ev.target.closest && ev.target.closest('[data-tip]');
      if (!el || !el.getAttribute('data-tip')) {
        if (alvo) { tt.hidden = true; alvo = null; }
        return;
      }
      if (el !== alvo) {
        alvo = el;
        tt.innerHTML = el.getAttribute('data-tip');
        tt.hidden = false;
      }
      posiciona(ev);
    });
    document.addEventListener('scroll', () => { tt.hidden = true; alvo = null; }, true);
  };
})();
