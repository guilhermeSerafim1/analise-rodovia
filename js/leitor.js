/* Leitura e interpretação do CSV de volume dos radares (ANTT). */
(function () {
  const R = (window.Radar = window.Radar || {});
  const L = (R.leitor = {});

  /** Decodifica bytes do CSV: UTF-8 se válido; senão Windows-1252 (formato publicado pela ANTT). */
  L.decodificar = function (buffer) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(buffer);
    }
  };

  function dividir(linha, sep) {
    if (linha.indexOf('"') < 0) return linha.split(sep);
    const out = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (aspas) {
        if (c === '"') {
          if (linha[i + 1] === '"') { atual += '"'; i++; } else aspas = false;
        } else atual += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { out.push(atual); atual = ''; }
      else atual += c;
    }
    out.push(atual);
    return out;
  }

  const pad = (n) => String(n).padStart(2, '0');

  function lerData(s) {
    s = (s || '').trim();
    let a, m, d, r;
    if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) { d = +r[1]; m = +r[2]; a = +r[3]; }
    else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { a = +r[1]; m = +r[2]; d = +r[3]; }
    else return null;
    const t = Date.UTC(a, m - 1, d);
    const dt = new Date(t);
    if (dt.getUTCMonth() !== m - 1) return null;
    return { chave: `${a}-${pad(m)}-${pad(d)}`, n: Math.round(t / 864e5), dow: dt.getUTCDay(), mes: `${a}-${pad(m)}` };
  }

  function numero(s) {
    const t = String(s ?? '').trim();
    if (!t) return NaN;
    return Number(t.indexOf(',') >= 0 ? t.replace(/\./g, '').replace(',', '.') : t);
  }

  /**
   * Interpreta o rótulo da categoria de velocidade do arquivo
   * ("<= 20 KM/h", "21 - 50 KM", "81 - 100 K", "> 160 KM/h"...).
   */
  L.infoVelocidade = function (bruto) {
    const t = String(bruto).replace(/\s+/g, '');
    const nums = (t.match(/\d+/g) || []).map(Number);
    if (!nums.length) return { bruto, rotulo: String(bruto).trim() || '(vazio)', min: Infinity, max: Infinity };
    if (/^(<=|≤|<)/.test(t)) return { bruto, rotulo: `≤ ${nums[0]} km/h`, min: 0, max: nums[0] };
    if (/^(>=|≥)/.test(t)) return { bruto, rotulo: `≥ ${nums[0]} km/h`, min: nums[0], max: Infinity };
    if (/^>/.test(t)) return { bruto, rotulo: `> ${nums[0]} km/h`, min: nums[0] + 1, max: Infinity };
    if (nums.length >= 2) return { bruto, rotulo: `${nums[0]}–${nums[1]} km/h`, min: nums[0], max: nums[1] };
    return { bruto, rotulo: `${nums[0]} km/h`, min: nums[0], max: nums[0] };
  };

  const OBRIGATORIAS = ['identificador', 'data_da_passagem', 'velocidade', 'tipo_de_veiculo', 'volume_total'];

  L.interpretar = function (texto) {
    texto = texto.replace(/^﻿/, '');
    const linhas = texto.split(/\r?\n/);
    const cab = linhas[0] || '';
    const sep = cab.split(';').length >= cab.split(',').length ? ';' : ',';
    const nomes = dividir(cab, sep).map((s) => s.trim().toLowerCase());
    const faltando = OBRIGATORIAS.filter((n) => nomes.indexOf(n) < 0);
    if (faltando.length) throw new Error('Colunas obrigatórias ausentes: ' + faltando.join(', '));
    const ix = (n) => nomes.indexOf(n);
    const I = {
      conc: ix('concessionaria'), eq: ix('identificador'), rod: ix('rodovia'), uf: ix('uf'),
      km: ix('km_m'), mun: ix('municipio'), pista: ix('tipo_de_pista'), lat: ix('latitude'),
      lon: ix('longitude'), data: ix('data_da_passagem'), sentido: ix('sentido_da_passagem'),
      faixa: ix('faixa_da_passagem'), vel: ix('velocidade'), tipo: ix('tipo_de_veiculo'), vol: ix('volume_total'),
    };
    const txt = (c, i) => (i < 0 ? '' : String(c[i] ?? '').trim());

    const linhasOk = [];
    let descartadas = 0;
    for (let i = 1; i < linhas.length; i++) {
      const l = linhas[i];
      if (!l || !l.trim()) continue;
      const c = dividir(l, sep);
      const d = lerData(c[I.data]);
      const vol = numero(c[I.vol]);
      if (!d || !Number.isFinite(vol)) { descartadas++; continue; }
      linhasOk.push({
        conc: txt(c, I.conc) || '(não informado)',
        eq: txt(c, I.eq) || '(sem identificador)',
        rod: txt(c, I.rod) || '(não informado)',
        uf: txt(c, I.uf) || '(não informado)',
        km: numero(c[I.km]),
        mun: txt(c, I.mun) || '(não informado)',
        pista: txt(c, I.pista) || '(não informado)',
        lat: numero(c[I.lat]),
        lon: numero(c[I.lon]),
        data: d.chave, dn: d.n, dow: d.dow, mes: d.mes,
        sentido: txt(c, I.sentido) || '(não informado)',
        faixa: txt(c, I.faixa) || '(não informado)',
        vel: txt(c, I.vel) || '(vazio)',
        tipo: txt(c, I.tipo) || '(vazio)',
        vol,
      });
    }
    return { linhas: linhasOk, descartadas };
  };
})();
