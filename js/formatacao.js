/* Formatação de números, percentuais e datas no padrão pt-BR. */
(function () {
  const R = (window.Radar = window.Radar || {});
  const F = (R.fmt = {});

  const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const casas = [0, 1, 2, 3, 4, 5, 6].map(
    (d) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
  );

  F.n = (v) => (Number.isFinite(v) ? inteiro.format(Math.round(v)) : '–');

  F.dec = (v, d = 1) => (Number.isFinite(v) ? casas[d].format(v) : '–');

  /** Percentual; recebe valor já em pontos percentuais (0–100). */
  F.p = (v, d = 1) => (Number.isFinite(v) ? casas[d].format(v) + '%' : '–');

  /** Percentual com casas adaptadas a valores muito pequenos. */
  F.pa = (v) => {
    if (!Number.isFinite(v)) return '–';
    if (v === 0) return '0%';
    const a = Math.abs(v);
    if (a < 0.001) return '< 0,001%';
    return F.p(v, a >= 1 ? 1 : a >= 0.1 ? 2 : 3);
  };

  /** Garante ponto final sem duplicar ("p.p." já termina em ponto). */
  F.fim = (s) => (/[.!?]$/.test(s) ? s : s + '.');

  /** Diferença em pontos percentuais, com sinal. */
  F.pp = (v, d = 1) => {
    if (!Number.isFinite(v)) return '–';
    const r = Number(v.toFixed(d));
    const s = r > 0 ? '+' : r < 0 ? '−' : '±';
    return s + casas[d].format(Math.abs(r)) + ' p.p.';
  };

  /** Variação percentual com sinal. */
  F.var = (v, d = 1) => {
    if (!Number.isFinite(v)) return '–';
    const r = Number(v.toFixed(d));
    const s = r > 0 ? '+' : r < 0 ? '−' : '±';
    return s + casas[d].format(Math.abs(r)) + '%';
  };

  /** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
  F.data = (chave) => {
    if (!chave) return '–';
    const [a, m, d] = chave.split('-');
    return `${d}/${m}/${a}`;
  };

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  /** 'AAAA-MM' → 'jan/2022' */
  F.mes = (chave) => {
    const [a, m] = chave.split('-');
    return `${MESES[Number(m) - 1]}/${a}`;
  };

  /** Número de dia (dias desde 1970-01-01, UTC) → 'AAAA-MM-DD' */
  F.chaveDia = (n) => new Date(n * 864e5).toISOString().slice(0, 10);

  F.esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /** Junta itens em português: "a, b e c". */
  F.lista = (itens) => {
    const a = itens.filter(Boolean);
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
  };

  F.plural = (n, sing, plur) => `${F.n(n)} ${n === 1 ? sing : plur}`;
})();
