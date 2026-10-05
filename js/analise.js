/* Agregações genéricas e contexto (ordens e cores estáveis) do conjunto de dados. */
(function () {
  const R = (window.Radar = window.Radar || {});
  const A = (R.analise = {});

  A.DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  A.DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  /** Ordem de exibição: segunda a domingo. */
  A.SEMANA = [1, 2, 3, 4, 5, 6, 0];

  // Paleta categórica validada (ordem fixa: a cor acompanha o tipo, nunca a posição).
  const CATEGORICA = {
    claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    escuro: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  };
  // Rampa ordinal azul para as categorias de velocidade (mais lenta = mais clara).
  const RAMPA = ['#b7d3f6', '#6da7ec', '#2a78d6', '#184f95'];
  const RAMPA_QUENTE = ['#f5b08c', '#eb6834', '#c2461a', '#8a2d0c'];
  const ORDEM_TIPOS = ['Passeio', 'Comercial', 'Moto', 'Não classificado'];

  A.escuro = () =>
    document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  /** Soma de volume_total. */
  A.total = (linhas) => {
    let s = 0;
    for (const r of linhas) s += r.vol;
    return s;
  };

  /** Map chave → soma de volume. */
  A.agrupar = (linhas, chave) => {
    const m = new Map();
    for (const r of linhas) {
      const k = chave(r);
      m.set(k, (m.get(k) || 0) + r.vol);
    }
    return m;
  };

  /** Map a → Map b → soma de volume. */
  A.cruzar = (linhas, ca, cb) => {
    const m = new Map();
    for (const r of linhas) {
      const a = ca(r);
      let mm = m.get(a);
      if (!mm) m.set(a, (mm = new Map()));
      const b = cb(r);
      mm.set(b, (mm.get(b) || 0) + r.vol);
    }
    return m;
  };

  /** Map chave → Set de datas distintas com registro. */
  A.datasPor = (linhas, chave) => {
    const m = new Map();
    for (const r of linhas) {
      const k = chave(r);
      let s = m.get(k);
      if (!s) m.set(k, (s = new Set()));
      s.add(r.data);
    }
    return m;
  };

  A.pct = (a, b) => (b ? (a / b) * 100 : NaN);

  /** Valores distintos de um campo. */
  A.distintos = (linhas, campo) => {
    const s = new Set();
    for (const r of linhas) s.add(r[campo]);
    return [...s];
  };

  /**
   * Contexto calculado sobre o arquivo inteiro (não filtrado): ordem dos tipos,
   * categorias de velocidade, equipamentos e cores. Assim, filtrar não repinta séries.
   */
  A.contexto = function (linhas) {
    const volTipo = A.agrupar(linhas, (r) => r.tipo);
    const tipos = [...volTipo.keys()].sort((a, b) => {
      const ia = ORDEM_TIPOS.indexOf(a), ib = ORDEM_TIPOS.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return volTipo.get(b) - volTipo.get(a);
    });

    const vels = A.distintos(linhas, 'vel')
      .map((b) => R.leitor.infoVelocidade(b))
      .sort((a, b) => a.min - b.min || a.max - b.max);
    const velInfo = new Map(vels.map((v) => [v.bruto, v]));

    const equip = new Map();
    for (const r of linhas) {
      let e = equip.get(r.eq);
      if (!e) {
        e = { id: r.eq, km: r.km, mun: r.mun, uf: r.uf, rod: r.rod, lat: r.lat, lon: r.lon, dnMin: r.dn, dnMax: r.dn };
        equip.set(r.eq, e);
      }
      if (r.dn < e.dnMin) e.dnMin = r.dn;
      if (r.dn > e.dnMax) e.dnMax = r.dn;
    }
    const equipamentos = [...equip.values()].sort(
      (a, b) => (Number.isFinite(a.km) ? a.km : 1e9) - (Number.isFinite(b.km) ? b.km : 1e9) || a.id.localeCompare(b.id)
    );

    // Período em que todos os equipamentos têm dados (interseção das coberturas).
    const ini = Math.max(...equipamentos.map((e) => e.dnMin));
    const fim = Math.min(...equipamentos.map((e) => e.dnMax));
    const periodoComum = ini <= fim ? { ini, fim } : null;

    return { tipos, vels, velInfo, equipamentos, periodoComum };
  };

  /** Cores por tipo de veículo (posição fixa na ordem do contexto). */
  A.coresTipos = function (ctx) {
    const pal = A.escuro() ? CATEGORICA.escuro : CATEGORICA.claro;
    return ctx.tipos.map((t, i) => pal[i % pal.length]);
  };

  /**
   * Cores ordinais para as categorias de velocidade: rampa azul (clara → escura) até 100 km/h
   * e rampa laranja acima de 100 km/h, para que o limiar fique visível nos gráficos.
   */
  A.coresVel = function (ctx) {
    const ate = ctx.vels.filter((v) => !A.acima100(v));
    const acima = ctx.vels.filter((v) => A.acima100(v));
    const passo = (rampa, n, i) => rampa[n <= 1 ? 0 : Math.round((i * (rampa.length - 1)) / (n - 1))];
    return ctx.vels.map((v) =>
      A.acima100(v) ? passo(RAMPA_QUENTE, acima.length, acima.indexOf(v)) : passo(RAMPA, ate.length, ate.indexOf(v))
    );
  };

  /** Categoria de velocidade acima de 100 km/h (limite inferior > 100). */
  A.acima100 = (info) => info.min > 100;

  /**
   * Para um conjunto de linhas, devolve a composição por tipo:
   * [{tipo, vol, pct}] na ordem do contexto.
   */
  A.composicao = function (linhas, ctx, campo = 'tipo') {
    const m = A.agrupar(linhas, (r) => r[campo]);
    const tot = A.total(linhas);
    const chaves = campo === 'tipo' ? ctx.tipos : ctx.vels.map((v) => v.bruto);
    return { total: tot, itens: chaves.map((k) => ({ chave: k, vol: m.get(k) || 0, pct: A.pct(m.get(k) || 0, tot) })) };
  };
})();
