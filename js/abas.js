/* Conteúdo das cinco abas. Todo texto interpretativo é derivado dos números calculados. */
(function () {
  const R = window.Radar;
  const A = R.analise, F = R.fmt, G = R.graficos;
  const AB = (R.abas = {});
  const esc = F.esc;

  /* ---------- Blocos de interface ---------- */
  const cab = (t, d) => `<div class="cabeca-aba"><h2>${t}</h2>${d ? `<p>${d}</p>` : ''}</div>`;
  const cartao = (t, corpo, nota = '') =>
    `<section class="cartao">${t ? `<h3>${t}</h3>` : ''}${nota ? `<p class="nota-cartao">${nota}</p>` : ''}${corpo}</section>`;
  const resposta = (p, r, d = '') =>
    `<div class="resposta"><div class="perg">${p}</div><div class="resp">${r}</div>${d ? `<div class="resp-det">${d}</div>` : ''}</div>`;
  const aviso = (t) => `<div class="aviso"><div>${t}</div></div>`;
  const texto = (html) => `<div class="texto">${html}</div>`;
  const ul = (itens) => (itens.length ? `<ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');

  /** cols: [{t, num?, cor?}]; linhas: [{cel: [...], cls?}] */
  function tabela(cols, linhas) {
    const th = cols
      .map((c) => `<th class="${c.num ? 'num' : ''}">${c.cor ? `<i class="marca-th" style="background:${c.cor}"></i>` : ''}${c.t}</th>`)
      .join('');
    const tr = linhas
      .map((l) => `<tr class="${l.cls || ''}">${l.cel.map((v, i) => `<td class="${cols[i] && cols[i].num ? 'num' : ''}">${v}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="tabela-rolagem"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }

  const seriesTipos = (ctx) => {
    const c = A.coresTipos(ctx);
    return ctx.tipos.map((t, i) => ({ nome: t, cor: c[i] }));
  };
  const seriesVel = (ctx) => {
    const c = A.coresVel(ctx);
    return ctx.vels.map((v, i) => ({ nome: v.rotulo, cor: c[i] }));
  };
  const rotVel = (ctx, bruto) => (ctx.velInfo.get(bruto) || { rotulo: bruto }).rotulo;
  const b = (s) => `<b>${s}</b>`;
  const ppClasse = (v) => (v >= 0.05 ? 'pos' : v <= -0.05 ? 'neg' : '');
  const porDezMil = (p) => F.dec(p * 100, p * 100 >= 10 ? 0 : 1);

  /**
   * Perfil de um subconjunto: volume, dias com registro e composições por tipo e velocidade.
   */
  function perfil(linhas, ctx) {
    const total = A.total(linhas);
    const dias = new Set(linhas.map((r) => r.data)).size;
    const tipo = A.agrupar(linhas, (r) => r.tipo);
    const vel = A.agrupar(linhas, (r) => r.vel);
    let acima100 = 0;
    for (const [k, v] of vel) if (A.acima100(ctx.velInfo.get(k))) acima100 += v;
    return {
      total, dias, mediaDia: dias ? total / dias : NaN,
      tipoVol: ctx.tipos.map((t) => tipo.get(t) || 0),
      tipoPct: ctx.tipos.map((t) => A.pct(tipo.get(t) || 0, total)),
      velVol: ctx.vels.map((v) => vel.get(v.bruto) || 0),
      velPct: ctx.vels.map((v) => A.pct(vel.get(v.bruto) || 0, total)),
      acima100, acima100Pct: A.pct(acima100, total),
    };
  }

  /** Separa as linhas por um campo, preservando uma ordem. */
  function separar(linhas, campo, ordem) {
    const m = new Map();
    for (const r of linhas) {
      const k = r[campo];
      let a = m.get(k);
      if (!a) m.set(k, (a = []));
      a.push(r);
    }
    const chaves = ordem ? ordem.filter((k) => m.has(k)) : [...m.keys()].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
    return chaves.map((k) => ({ chave: k, linhas: m.get(k) }));
  }

  const indiceModal = (arr) => arr.reduce((im, v, i) => (v > arr[im] ? i : im), 0);

  /* =====================================================================
   * ABA 1 — Caracterização do conjunto de dados
   * ===================================================================== */
  AB.caracterizacao = function (linhas, ctx, meta) {
    const total = A.total(linhas);
    const dns = [...new Set(linhas.map((r) => r.dn))].sort((a, b) => a - b);
    const dMin = dns[0], dMax = dns[dns.length - 1];
    const calendario = dMax - dMin + 1;
    const lacunas = [];
    for (let i = 1; i < dns.length; i++)
      if (dns[i] - dns[i - 1] > 1) lacunas.push({ ini: dns[i - 1] + 1, fim: dns[i] - 1, n: dns[i] - dns[i - 1] - 1 });
    const diasSem = lacunas.reduce((s, l) => s + l.n, 0);

    // Equipamentos presentes no recorte
    const est = new Map();
    for (const r of linhas) {
      let e = est.get(r.eq);
      if (!e) est.set(r.eq, (e = { vol: 0, sentidos: new Set(), faixas: new Set(), dias: new Set(), min: r.dn, max: r.dn }));
      e.vol += r.vol;
      e.sentidos.add(r.sentido);
      e.faixas.add(r.faixa);
      e.dias.add(r.dn);
      if (r.dn < e.min) e.min = r.dn;
      if (r.dn > e.max) e.max = r.dn;
    }
    const eqs = ctx.equipamentos.filter((e) => est.has(e.id));

    const contar = (campo) => {
      const m = new Map();
      for (const r of linhas) {
        let x = m.get(r[campo]);
        if (!x) m.set(r[campo], (x = { vol: 0, eqs: new Set() }));
        x.vol += r.vol;
        x.eqs.add(r.eq);
      }
      return [...m.entries()].sort((a, b) => b[1].vol - a[1].vol);
    };
    const chips = (pares, comEq = true) =>
      pares
        .map(([k, x]) => `<span class="chip">${esc(k)}${comEq ? ` <small>· ${F.plural(x.eqs.size, 'equip.', 'equip.')}</small>` : ''}</span>`)
        .join('');

    const kpis = `<div class="kpis">
      <div class="kpi"><div class="rot">Período analisado</div><div class="val menor">${F.data(F.chaveDia(dMin))} a ${F.data(F.chaveDia(dMax))}</div>
        <div class="det">${F.n(calendario)} dias no calendário · ${F.n(dns.length)} com registro</div></div>
      <div class="kpi"><div class="rot">Equipamentos (radares)</div><div class="val">${F.n(eqs.length)}</div>
        <div class="det">${eqs.map((e) => esc(e.id)).join(', ')}</div></div>
      <div class="kpi"><div class="rot">Volume total registrado</div><div class="val">${F.n(total)}</div>
        <div class="det">veículos em ${F.n(linhas.length)} registros agregados</div></div>
      <div class="kpi"><div class="rot">Média diária</div><div class="val">${F.n(total / dns.length)}</div>
        <div class="det">veículos por dia com registro (soma dos equipamentos)</div></div>
    </div>`;

    const abrangencia = cartao(
      'Rodovia, estado e municípios',
      `<dl class="lista-def">
        <dt>Concessionária</dt><dd>${chips(contar('conc'), false)}</dd>
        <dt>Rodovia(s)</dt><dd>${chips(contar('rod'), false)}</dd>
        <dt>Estado(s) (UF)</dt><dd>${chips(contar('uf'), false)}</dd>
        <dt>Município(s)</dt><dd>${chips(contar('mun'))}</dd>
        <dt>Tipo de pista</dt><dd>${chips(contar('pista'), false)}</dd>
      </dl>`
    );

    const tabEq = cartao(
      'Equipamentos',
      tabela(
        [
          { t: 'Identificador' }, { t: 'km', num: true }, { t: 'Município / UF' }, { t: 'Sentido' }, { t: 'Faixa' },
          { t: 'Coordenadas' }, { t: 'Período com dados' }, { t: 'Dias com dados', num: true }, { t: 'Volume', num: true }, { t: '% do total', num: true },
        ],
        eqs.map((e) => {
          const s = est.get(e.id);
          const cobertura = A.pct(s.dias.size, calendario);
          return {
            cel: [
              b(esc(e.id)), F.dec(e.km, 0), `${esc(e.mun)} / ${esc(e.uf)}`, [...s.sentidos].map(esc).join(', '), [...s.faixas].map(esc).join(', '),
              Number.isFinite(e.lat) ? `${F.dec(e.lat, 5)}; ${F.dec(e.lon, 5)}` : '–',
              `${F.data(F.chaveDia(s.min))} a ${F.data(F.chaveDia(s.max))}`,
              `${F.n(s.dias.size)}<small>${F.p(cobertura, 0)} do período</small>`,
              F.n(s.vol), F.p(A.pct(s.vol, total)),
            ],
          };
        })
      ),
      'Cada linha do arquivo é um agregado diário por equipamento, sentido, faixa, categoria de velocidade e tipo de veículo.'
    );

    const pf = perfil(linhas, ctx);
    const st = seriesTipos(ctx);
    const sv = seriesVel(ctx);

    const tipos = cartao(
      'Tipos de veículo',
      G.barras100([{ rotulo: 'Todos os registros', valores: pf.tipoVol }], st) +
        '<div style="height:12px"></div>' +
        tabela(
          [{ t: 'Tipo de veículo' }, { t: 'Volume', num: true }, { t: '% do total', num: true }],
          ctx.tipos
            .map((t, i) => ({ cel: [`<i class="marca-th" style="background:${st[i].cor}"></i>${esc(t)}`, F.n(pf.tipoVol[i]), F.p(pf.tipoPct[i])] }))
            .concat([{ cls: 'total', cel: ['Total', F.n(total), '100,0%'] }])
        ),
      `${F.plural(ctx.tipos.length, 'tipo distinto', 'tipos distintos')} no campo <code>tipo_de_veiculo</code>.`
    );

    const velocidades = cartao(
      'Categorias de velocidade',
      tabela(
        [{ t: 'Categoria' }, { t: 'Valor no arquivo' }, { t: 'Volume', num: true }, { t: '% do total', num: true }],
        ctx.vels
          .map((v, i) => ({
            cel: [`<i class="marca-th" style="background:${sv[i].cor}"></i>${esc(v.rotulo)}`, `<code>${esc(v.bruto)}</code>`, F.n(pf.velVol[i]), F.pa(pf.velPct[i])],
          }))
          .concat([{ cls: 'total', cel: ['Total', '', F.n(total), '100,0%'] }])
      ),
      `${F.plural(ctx.vels.length, 'categoria', 'categorias')} no campo <code>velocidade</code>, ordenadas pelo limite inferior.`
    );

    // Sentidos × faixas
    const sentidos = A.distintos(linhas, 'sentido').sort();
    const faixas = A.distintos(linhas, 'faixa').sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
    const sf = A.cruzar(linhas, (r) => r.sentido, (r) => r.faixa);
    const volF = A.agrupar(linhas, (r) => r.faixa);
    const eqPorSentido = new Map(separar(linhas, 'sentido').map((g) => [g.chave, A.distintos(g.linhas, 'eq')]));
    const umParaUm =
      sentidos.every((s) => [...(sf.get(s) || new Map()).values()].filter((v) => v > 0).length === 1) &&
      faixas.every((f) => sentidos.filter((s) => (sf.get(s) || new Map()).get(f) > 0).length === 1);
    const sentFaixa = cartao(
      'Sentidos e faixas de passagem',
      tabela(
        [{ t: 'Sentido' }, ...faixas.map((f) => ({ t: `Faixa ${esc(f)}`, num: true })), { t: 'Total', num: true }, { t: '% do total', num: true }, { t: 'Equipamentos' }],
        sentidos
          .map((s) => {
            const m = sf.get(s) || new Map();
            const tot = [...m.values()].reduce((a, c) => a + c, 0);
            return { cel: [b(esc(s)), ...faixas.map((f) => (m.get(f) ? F.n(m.get(f)) : '—')), F.n(tot), F.p(A.pct(tot, total)), (eqPorSentido.get(s) || []).map(esc).join(', ')] };
          })
          .concat([{ cls: 'total', cel: ['Total', ...faixas.map((f) => F.n(volF.get(f) || 0)), F.n(total), '100,0%', ''] }])
      ) +
        (umParaUm && sentidos.length > 1
          ? aviso(`Cada faixa aparece em um único sentido: ${F.lista(sentidos.map((s) => `${esc(s)} → faixa ${[...(sf.get(s) || new Map()).keys()].map(esc).join(', ')}`))}. Por isso, sentido e faixa descrevem os mesmos registros neste arquivo.`)
          : ''),
      `${F.plural(sentidos.length, 'sentido', 'sentidos')} e ${F.plural(faixas.length, 'faixa', 'faixas')} registrados.`
    );

    const maiores = [...lacunas].sort((a, b) => b.n - a.n).slice(0, 5);
    const qualidade = cartao(
      'Cobertura temporal e qualidade',
      texto(
        ul([
          `${F.n(dns.length)} dos ${F.n(calendario)} dias do período têm ao menos um registro; ${F.plural(diasSem, 'dia não tem', 'dias não têm')} nenhum registro (${F.p(A.pct(diasSem, calendario))} do calendário).`,
          maiores.length
            ? `Maiores intervalos sem registros: ${F.lista(maiores.map((l) => (l.n === 1 ? F.data(F.chaveDia(l.ini)) : `${F.data(F.chaveDia(l.ini))} a ${F.data(F.chaveDia(l.fim))} (${l.n} dias)`)))}.`
            : 'Não há dias sem registro no período.',
          `Os equipamentos não cobrem o mesmo período (veja a tabela de equipamentos). Comparações de volume absoluto entre equipamentos devem usar a média diária, ou o filtro “Período comum a todos os equipamentos”.`,
          meta.descartadas ? `${F.n(meta.descartadas)} linha(s) do arquivo foram ignoradas por data ou volume inválidos.` : 'Todas as linhas do arquivo foram lidas sem erro de data ou volume.',
        ])
      )
    );

    return (
      cab('Caracterização do conjunto de dados', 'Visão geral do arquivo: período, equipamentos, localização, categorias presentes e volume registrado.') +
      kpis +
      `<div class="grade">${abrangencia}${qualidade}</div><div style="height:18px"></div>` +
      tabEq +
      `<div class="grade-2">${tipos}${velocidades}</div>` +
      sentFaixa
    );
  };

  /* =====================================================================
   * ABA 2 — Tipo de veículo × velocidade
   * ===================================================================== */
  const LIMIAR_PEQUENO = 0.1; // categoria com menos de 0,1% do volume total

  AB.composicao = function (linhas, ctx) {
    const total = A.total(linhas);
    const cruz = A.cruzar(linhas, (r) => r.vel, (r) => r.tipo);
    const st = seriesTipos(ctx);
    const T = ctx.tipos;

    const cats = ctx.vels
      .map((v) => {
        const m = cruz.get(v.bruto) || new Map();
        const vals = T.map((t) => m.get(t) || 0);
        const vol = vals.reduce((a, c) => a + c, 0);
        return { v, vol, part: A.pct(vol, total), vals, pcts: vals.map((x) => A.pct(x, vol)), pequena: A.pct(vol, total) < LIMIAR_PEQUENO };
      })
      .filter((c) => c.vol > 0);
    if (!cats.length) return cab('Tipo de veículo × velocidade') + aviso('Não há registros no recorte selecionado.');

    const geralVol = T.map((t, i) => cats.reduce((s, c) => s + c.vals[i], 0));
    const geralPct = geralVol.map((v) => A.pct(v, total));

    const tabPct = tabela(
      [{ t: 'Velocidade' }, ...T.map((t, i) => ({ t: esc(t), num: true, cor: st[i].cor })), { t: 'Soma', num: true }, { t: 'Volume da categoria', num: true }, { t: '% do volume total', num: true }],
      cats
        .map((c) => ({
          cls: c.pequena ? 'baixo' : '',
          cel: [
            `${b(esc(c.v.rotulo))}${c.pequena ? '<span class="etiqueta-alerta">volume muito pequeno</span>' : ''}`,
            ...c.pcts.map((p, i) => `${F.p(p)}${c.pequena ? `<small>${F.plural(c.vals[i], 'veículo', 'veículos')}</small>` : ''}`),
            F.p(c.pcts.reduce((a, x) => a + x, 0)),
            F.n(c.vol),
            F.pa(c.part),
          ],
        }))
        .concat([{ cls: 'total', cel: ['Todas as categorias', ...geralPct.map((p) => F.p(p)), F.p(100), F.n(total), '100,0%'] }])
    );

    const tabAbs = tabela(
      [{ t: 'Velocidade' }, ...T.map((t, i) => ({ t: esc(t), num: true, cor: st[i].cor })), { t: 'Total', num: true }],
      cats
        .map((c) => ({ cls: c.pequena ? 'baixo' : '', cel: [b(esc(c.v.rotulo)), ...c.vals.map(F.n), F.n(c.vol)] }))
        .concat([{ cls: 'total', cel: ['Total', ...geralVol.map(F.n), F.n(total)] }])
    );

    const grafico = G.barras100(
      cats.map((c) => ({ rotulo: c.v.rotulo, sub: `${F.n(c.vol)} veíc.${c.pequena ? ' ⚠' : ''}`, valores: c.vals })),
      st
    );

    /* ----- Interpretação ----- */
    let principais = cats.filter((c) => c.part >= 1);
    if (!principais.length) principais = [cats.reduce((a, c) => (c.vol > a.vol ? c : a))];
    const pequenas = cats.filter((c) => c.pequena);
    const partPrinc = principais.reduce((s, c) => s + c.part, 0);

    const amplitude = T.map((t, i) => {
      const ps = principais.map((c) => ({ c, p: c.pcts[i] }));
      const mn = ps.reduce((a, x) => (x.p < a.p ? x : a));
      const mx = ps.reduce((a, x) => (x.p > a.p ? x : a));
      return { t, i, mn, mx, amp: mx.p - mn.p };
    });
    const maiorAmp = amplitude.reduce((a, x) => (x.amp > a.amp ? x : a));
    const estavel = maiorAmp.amp < 10;

    // Quanto cada categoria principal se afasta da composição geral (maior desvio absoluto entre os tipos).
    const desvios = principais.map((c) => {
      const ds = c.pcts.map((p, i) => ({ i, d: p - geralPct[i] }));
      const m = ds.reduce((a, x) => (Math.abs(x.d) > Math.abs(a.d) ? x : a));
      return { c, m };
    });
    let desvioTexto = '';
    if (desvios.length > 1) {
      const longe = desvios.reduce((a, x) => (Math.abs(x.m.d) > Math.abs(a.m.d) ? x : a));
      const perto = desvios.reduce((a, x) => (Math.abs(x.m.d) < Math.abs(a.m.d) ? x : a));
      desvioTexto =
        `A categoria que mais se afasta da composição geral é ${esc(longe.c.v.rotulo)} (${esc(T[longe.m.i])} ${F.pp(longe.m.d)}); ` +
        `a mais próxima é ${esc(perto.c.v.rotulo)} (desvio máximo de ${F.dec(Math.abs(perto.m.d), 1)} p.p.)` +
        (perto.c.part >= 50 ? `, que concentra ${F.p(perto.c.part)} do volume e, por isso, praticamente determina a composição geral.` : '.');
    }

    const sequencias = T.map(
      (t, i) =>
        `${b(esc(t))}: <span class="sequencia">${cats.map((c) => `${F.p(c.pcts[i], 1)}${c.pequena ? '*' : ''}`).join(' → ')}</span>`
    );

    const concentracoes = [];
    amplitude.forEach(({ t, i, mx }) => {
      const razao = mx.p / geralPct[i];
      if (mx.p - geralPct[i] >= 5 && razao >= 1.5) {
        concentracoes.push(
          `${b(esc(t))} representa ${F.p(mx.p)} dos veículos em ${esc(mx.c.v.rotulo)}, contra ${F.p(geralPct[i])} no conjunto (${F.dec(razao, 1)} vezes mais). ` +
            `Essa categoria de velocidade reúne ${F.p(A.pct(mx.c.vals[i], geralVol[i]))} de todos os veículos do tipo ${esc(t)}.`
        );
      }
    });

    const itensPequenos = pequenas.map((c) => {
      const im = indiceModal(c.vals);
      const zeros = T.filter((t, i) => c.vals[i] === 0);
      const elevados = T.map((t, i) => i).filter((i) => {
        const d = c.pcts[i] - geralPct[i];
        return i !== im && (d >= 5 || (d >= 2 && c.pcts[i] / geralPct[i] >= 1.5));
      });
      return (
        `${b(esc(c.v.rotulo))}: ${F.plural(c.vol, 'veículo', 'veículos')} (${F.pa(c.part)} do total). ` +
        `${esc(T[im])} aparece com ${F.p(c.pcts[im])}, o que corresponde a ${F.plural(c.vals[im], 'veículo', 'veículos')}. ` +
        elevados
          .map((i) => `${esc(T[i])} chega a ${F.p(c.pcts[i])} (${F.dec(c.pcts[i] / geralPct[i], 1)} vezes a sua participação geral de ${F.p(geralPct[i])}), mas isso equivale a apenas ${F.plural(c.vals[i], 'veículo', 'veículos')}. `)
          .join('') +
        `Cada veículo a mais ou a menos altera a composição em cerca de ${F.dec(100 / c.vol, 100 / c.vol >= 1 ? 1 : 2)} p.p.` +
        (zeros.length ? ` Não há registros de ${F.lista(zeros.map(esc))}.` : '')
      );
    });

    // Categorias acima de 100 km/h somadas
    const acima = cats.filter((c) => A.acima100(c.v));
    let blocoAcima = '';
    if (acima.length) {
      const vals = T.map((t, i) => acima.reduce((s, c) => s + c.vals[i], 0));
      const vol = vals.reduce((a, c) => a + c, 0);
      blocoAcima = `<p>Somadas, as ${F.plural(acima.length, 'categoria', 'categorias')} acima de 100 km/h reúnem ${F.plural(vol, 'veículo', 'veículos')} (${F.pa(A.pct(vol, total))} do total), com composição ${F.lista(
        T.map((t, i) => `${esc(t)} ${F.p(A.pct(vals[i], vol))}`)
      )}. Mesmo agregadas, essas categorias continuam representando uma parcela muito pequena do tráfego.</p>`;
    }

    const respTxt = estavel
      ? 'Sim, a composição é relativamente estável entre as categorias com volume relevante.'
      : 'Não. A composição dos tipos de veículos muda entre as categorias de velocidade.';
    const respDet = `Considerando as categorias com ao menos 1% do volume (${F.lista(principais.map((c) => esc(c.v.rotulo)))}, que somam ${F.p(partPrinc)} do tráfego), a maior variação é a de ${esc(maiorAmp.t)}: de ${F.p(maiorAmp.mn.p)} em ${esc(maiorAmp.mn.c.v.rotulo)} a ${F.p(maiorAmp.mx.p)} em ${esc(maiorAmp.mx.c.v.rotulo)} (amplitude de ${F.dec(maiorAmp.amp, 1)} p.p.).`;

    const interpretacao = cartao(
      'Interpretação',
      resposta('A composição dos tipos de veículos é semelhante entre as categorias de velocidade?', respTxt, respDet) +
        texto(
          `<h4>Como a participação de cada tipo evolui com a velocidade</h4>
          <p>Participação de cada tipo, da categoria mais lenta para a mais rápida (* = categoria com volume muito pequeno):</p>
          ${ul(sequencias)}
          <h4>Estabilidade da composição</h4>
          <p>${
            estavel
              ? `Nas categorias com volume relevante, nenhum tipo varia mais de 10 p.p. de participação; a frota mantém proporções parecidas à medida que a velocidade aumenta.`
              : F.fim(`A participação dos tipos não se mantém constante: entre as categorias com volume relevante, ${F.lista(
                  amplitude.filter((a) => a.amp >= 5).map((a) => `${esc(a.t)} varia ${F.dec(a.amp, 1)} p.p.`)
                )}`) + ' ' + desvioTexto
          }</p>
          ${concentracoes.length ? ul(concentracoes) : ''}
          ${
            pequenas.length
              ? `<h4>Percentuais elevados com volumes muito pequenos</h4>
                ${aviso(`As categorias abaixo têm menos de ${F.p(LIMIAR_PEQUENO)} do volume total. Nelas, percentuais altos (ou zeros) descrevem poucas dezenas ou centenas de veículos e não devem ser lidos com o mesmo peso das categorias principais.`)}
                ${ul(itensPequenos)}`
              : ''
          }
          ${blocoAcima}
          <p class="nota-cartao">Os percentuais são participações dentro de cada categoria de velocidade (cada linha soma ≈ 100%). Eles descrevem a composição registrada, mas não indicam a velocidade típica de cada tipo; para isso, veja a aba 3.</p>`
        )
    );

    return (
      cab(
        'Tipo de veículo × velocidade',
        'Para cada categoria de velocidade, a participação percentual de cada tipo de veículo no volume da categoria.'
      ) +
      cartao('Participação por tipo de veículo em cada categoria de velocidade', tabPct, 'Linhas destacadas: categorias com menos de 0,1% do volume total; nelas são mostrados também os volumes absolutos.') +
      `<div class="grade-2">${cartao('Composição por categoria de velocidade', grafico, 'Passe o mouse sobre os segmentos para ver valores.')}${cartao('Volumes absolutos', tabAbs)}</div>` +
      interpretacao
    );
  };

  /* =====================================================================
   * ABA 3 — Distribuição de velocidade por tipo e homogeneidade entre pontos
   * ===================================================================== */
  AB.distribuicao = function (linhas, ctx) {
    const total = A.total(linhas);
    if (!total) return cab('Distribuição de velocidade por tipo de veículo') + aviso('Não há registros no recorte selecionado.');
    const st = seriesTipos(ctx);
    const sv = seriesVel(ctx);
    const V = ctx.vels;
    const ate50 = V.map((v) => v.max <= 50);

    /* ----- Parte A: distribuição por tipo ----- */
    const grupos = separar(linhas, 'tipo', ctx.tipos).map((g) => ({ tipo: g.chave, p: perfil(g.linhas, ctx) }));
    const geral = perfil(linhas, ctx);

    const tabTipoVel = tabela(
      [{ t: 'Tipo de veículo' }, ...V.map((v, i) => ({ t: esc(v.rotulo), num: true, cor: sv[i].cor })), { t: 'Acima de 100 km/h', num: true }, { t: 'Volume', num: true }],
      grupos
        .map((g) => ({
          cel: [b(esc(g.tipo)), ...g.p.velPct.map(F.pa), `${F.pa(g.p.acima100Pct)}<small>${porDezMil(g.p.acima100Pct)} por 10 mil</small>`, F.n(g.p.total)],
        }))
        .concat([{ cls: 'total', cel: ['Todos', ...geral.velPct.map(F.pa), F.pa(geral.acima100Pct), F.n(total)] }])
    );
    const grafTipoVel = G.barras100(
      grupos.map((g) => ({ rotulo: g.tipo, sub: `${F.n(g.p.total)} veíc.`, valores: g.p.velVol })),
      sv,
      { limiteRotulo: 8 }
    );
    const pctAte50 = (p) => p.velPct.reduce((s, x, i) => s + (ate50[i] ? x : 0), 0);
    const leituraTipos = grupos.map((g) => {
      const im = indiceModal(g.p.velVol);
      return `${b(esc(g.tipo))}: categoria mais frequente ${esc(V[im].rotulo)} (${F.p(g.p.velPct[im])}); ${F.p(pctAte50(g.p))} até 50 km/h; ${F.pa(g.p.acima100Pct)} acima de 100 km/h (${F.plural(g.p.acima100, 'veículo', 'veículos')}).`;
    });
    const maisRapido = grupos.filter((g) => g.p.total >= total * 0.01).reduce((a, g) => (!a || g.p.acima100Pct > a.p.acima100Pct ? g : a), null);
    const maisLento = grupos.reduce((a, g) => (!a || pctAte50(g.p) > pctAte50(a.p) ? g : a), null);

    const parteA =
      cartao('Distribuição das categorias de velocidade dentro de cada tipo', tabTipoVel, 'Cada linha soma ≈ 100%: mostra como os veículos de um tipo se distribuem pelas categorias de velocidade.') +
      `<div class="grade-2">${cartao('Distribuição por tipo de veículo', grafTipoVel)}${cartao(
        'Leitura',
        texto(
          ul(leituraTipos) +
            (maisLento && maisRapido
              ? `<p>${esc(maisLento.tipo)} é o tipo com maior parcela de registros até 50 km/h (${F.p(pctAte50(maisLento.p))}). Entre os tipos com ao menos 1% do volume, ${esc(maisRapido.tipo)} tem a maior proporção acima de 100 km/h (${porDezMil(maisRapido.p.acima100Pct)} a cada 10 mil veículos).</p>`
              : '')
        )
      )}</div>`;

    /* ----- Parte B: homogeneidade entre os pontos monitorados ----- */
    const ordemEq = ctx.equipamentos.map((e) => e.id);
    const eqs = separar(linhas, 'eq', ordemEq).map((g) => {
      const info = ctx.equipamentos.find((e) => e.id === g.chave);
      return { id: g.chave, info, sentidos: A.distintos(g.linhas, 'sentido'), faixas: A.distintos(g.linhas, 'faixa'), p: perfil(g.linhas, ctx) };
    });

    let parteB;
    if (eqs.length < 2) {
      parteB = cartao('Homogeneidade entre os pontos monitorados', aviso('Há apenas um equipamento no recorte atual. Selecione “Todos” no filtro de equipamento para comparar os pontos da rodovia.'));
    } else {
      const maxMedia = Math.max(...eqs.map((e) => e.p.mediaDia));
      const mapa = cartao(
        'Pontos monitorados ao longo da rodovia',
        G.faixaKm(
          eqs.map((e) => ({
            id: e.id, km: e.info.km, valor: e.p.mediaDia,
            tip: `<b>${esc(e.id)}</b> — km ${F.dec(e.info.km, 0)}<br>${esc(e.info.mun)}<br>Média diária: ${F.n(e.p.mediaDia)} veíc.<br>Sentido: ${e.sentidos.map(esc).join(', ')}`,
          })),
          st[0].cor
        ),
        'Posição pelo km informado no arquivo; a área do círculo é proporcional à média diária de veículos.'
      );

      const tabVol = tabela(
        [
          { t: 'Equipamento' }, { t: 'km', num: true }, { t: 'Município' }, { t: 'Sentido / faixa' }, { t: 'Dias com dados', num: true },
          { t: 'Volume total', num: true }, { t: '% do total', num: true }, { t: 'Média diária', num: true }, { t: 'Relativo à maior média', num: true },
        ],
        eqs.map((e) => ({
          cel: [
            b(esc(e.id)), F.dec(e.info.km, 0), esc(e.info.mun), `${e.sentidos.map(esc).join(', ')} / ${e.faixas.map(esc).join(', ')}`,
            F.n(e.p.dias), F.n(e.p.total), F.p(A.pct(e.p.total, total)), F.n(e.p.mediaDia), F.p(A.pct(e.p.mediaDia, maxMedia), 0),
          ],
        }))
      );

      const tabTipos = tabela(
        [{ t: 'Equipamento' }, ...ctx.tipos.map((t, i) => ({ t: esc(t), num: true, cor: st[i].cor }))],
        eqs
          .map((e) => ({
            cel: [
              b(esc(e.id)),
              ...e.p.tipoPct.map((p, i) => {
                const d = p - geral.tipoPct[i];
                return `${F.p(p)}<small class="${Math.abs(d) >= 5 ? ppClasse(d) + ' forte' : ''}">${F.pp(d)}</small>`;
              }),
            ],
          }))
          .concat([{ cls: 'total', cel: ['Conjunto', ...geral.tipoPct.map((p) => F.p(p))] }])
      );
      const grafTipos = G.barras100(
        [{ rotulo: 'Conjunto', valores: geral.tipoVol }].concat(eqs.map((e) => ({ rotulo: e.id, sub: `km ${F.dec(e.info.km, 0)}`, valores: e.p.tipoVol }))),
        st
      );

      const tabVel = tabela(
        [{ t: 'Equipamento' }, ...V.map((v, i) => ({ t: esc(v.rotulo), num: true, cor: sv[i].cor })), { t: '> 100 km/h por 10 mil', num: true }],
        eqs
          .map((e) => ({ cel: [b(esc(e.id)), ...e.p.velPct.map(F.pa), porDezMil(e.p.acima100Pct)] }))
          .concat([{ cls: 'total', cel: ['Conjunto', ...geral.velPct.map(F.pa), porDezMil(geral.acima100Pct)] }])
      );
      const grafVel = G.barras100(
        [{ rotulo: 'Conjunto', valores: geral.velVol }].concat(eqs.map((e) => ({ rotulo: e.id, sub: `km ${F.dec(e.info.km, 0)}`, valores: e.p.velVol }))),
        sv,
        { limiteRotulo: 8 }
      );

      /* Constatações diretamente suportadas pelos dados */
      const achados = [];
      const porMedia = [...eqs].sort((a, c) => c.p.mediaDia - a.p.mediaDia);
      const maior = porMedia[0], menor = porMedia[porMedia.length - 1];
      const razaoVol = maior.p.mediaDia / menor.p.mediaDia;
      achados.push(
        `${b('Volume')}: a média diária varia de ${F.n(menor.p.mediaDia)} veículos em ${esc(menor.id)} a ${F.n(maior.p.mediaDia)} em ${esc(maior.id)} — ${F.dec(razaoVol, 1)} vezes mais. ` +
          `Ordem decrescente de média diária: ${porMedia.map((e) => esc(e.id)).join(' > ')}.`
      );

      let difTipos = 0;
      eqs.forEach((e) => {
        const partes = [];
        e.p.tipoPct.forEach((p, i) => {
          const d = p - geral.tipoPct[i];
          if (Math.abs(d) >= 5) partes.push(`${esc(ctx.tipos[i])} ${F.p(p)} (${F.pp(d)})`);
        });
        const ausentes = ctx.tipos.filter((t, i) => e.p.tipoVol[i] === 0 && geral.tipoVol[i] > 0);
        if (partes.length || ausentes.length) {
          difTipos++;
          achados.push(
            `${b(`Composição em ${esc(e.id)}`)}: ` +
              (partes.length ? `${F.lista(partes)}, em comparação com o conjunto dos equipamentos.` : '') +
              (ausentes.length ? ` Não há nenhum registro de ${F.lista(ausentes.map(esc))} neste equipamento.` : '')
          );
        }
      });

      const modais = eqs.map((e) => ({ e, im: indiceModal(e.p.velVol) }));
      const modaisDistintos = new Set(modais.map((m) => m.im)).size > 1;
      achados.push(
        `${b('Velocidade')}: a categoria mais frequente é ` +
          F.lista(
            separar(modais.map((m) => ({ ...m, k: m.im })), 'k')
              .map((g) => `${esc(V[g.chave].rotulo)} em ${F.lista(g.linhas.map((m) => `${esc(m.e.id)} (${F.p(m.e.p.velPct[m.im])})`))}`)
          ) +
          '.'
      );
      eqs.forEach((e) => {
        const partes = [];
        e.p.velPct.forEach((p, i) => {
          const d = p - geral.velPct[i];
          if (Math.abs(d) >= 10) partes.push(`${esc(V[i].rotulo)} ${F.p(p)} (${F.pp(d)})`);
        });
        if (partes.length) achados.push(`${b(`Distribuição de velocidade em ${esc(e.id)}`)}: ${F.lista(partes)} em relação ao conjunto.`);
      });
      const porAcima = [...eqs].sort((a, c) => c.p.acima100Pct - a.p.acima100Pct);
      achados.push(
        `${b('Acima de 100 km/h')}: de ${porDezMil(porAcima[porAcima.length - 1].p.acima100Pct)} (${esc(porAcima[porAcima.length - 1].id)}) a ${porDezMil(porAcima[0].p.acima100Pct)} (${esc(porAcima[0].id)}) veículos a cada 10 mil.`
      );

      const heterogeneo = difTipos > 0 || modaisDistintos || razaoVol >= 2;
      const conclusao = resposta(
        'Existem trechos com composição de tráfego diferente?',
        heterogeneo ? 'Sim. O perfil do tráfego não é homogêneo entre os pontos monitorados.' : 'Não foram encontradas diferenças relevantes entre os pontos monitorados.',
        heterogeneo
          ? `As diferenças aparecem ${F.lista(
              [razaoVol >= 2 ? 'no volume médio diário' : '', difTipos ? 'na participação dos tipos de veículos' : '', modaisDistintos ? 'na categoria de velocidade predominante' : ''].filter(Boolean)
            )}. Critérios: diferença ≥ 5 p.p. na participação de um tipo, ≥ 10 p.p. em uma categoria de velocidade, ou razão ≥ 2 entre médias diárias.`
          : 'Critérios: diferença ≥ 5 p.p. na participação de um tipo, ≥ 10 p.p. em uma categoria de velocidade, ou razão ≥ 2 entre médias diárias.'
      );

      const sentidosDistintos = new Set(eqs.map((e) => e.sentidos.join('/'))).size > 1;
      const coberturas = eqs.map((e) => e.p.dias);
      const coberturaDesigual = Math.max(...coberturas) > 1.5 * Math.min(...coberturas);
      const limites = [
        'As diferenças acima são descritivas: o arquivo informa contagens por tipo e por faixa de velocidade, sem variáveis sobre geometria da via, uso do solo, sinalização, limite de velocidade, fiscalização, clima ou eventos. Por isso, ele não permite atribuir causas às diferenças observadas.',
        sentidosDistintos
          ? `Os equipamentos não registram o mesmo sentido (${F.lista(eqs.map((e) => `${esc(e.id)}: ${e.sentidos.map(esc).join('/')}`))}). Diferenças entre pontos podem, portanto, se confundir com diferenças entre sentidos.`
          : '',
        coberturaDesigual
          ? `Os períodos cobertos são diferentes (de ${F.n(Math.min(...coberturas))} a ${F.n(Math.max(...coberturas))} dias com dados). Por isso, o volume é comparado pela média diária; use o filtro “Período comum a todos os equipamentos” para comparar os pontos no mesmo intervalo de datas.`
          : '',
        'A ausência de um tipo de veículo em um equipamento significa apenas que não há registros desse tipo no arquivo; o arquivo não informa o motivo.',
      ].filter(Boolean);

      parteB =
        `<div class="cabeca-aba" style="margin-top:28px"><h2>Homogeneidade entre os pontos monitorados</h2><p>Comparação dos equipamentos (quilômetros) quanto a volume, participação por tipo de veículo e distribuição das categorias de velocidade.</p></div>` +
        mapa +
        cartao('Volume por equipamento', tabVol, 'A média diária divide o volume pelos dias com registro de cada equipamento, o que neutraliza diferenças de cobertura.') +
        `<div class="grade-2">${cartao('Participação por tipo de veículo', tabTipos, 'Abaixo de cada percentual: diferença em relação ao conjunto (destacada quando ≥ 5 p.p.).')}${cartao('Composição por equipamento', grafTipos)}</div>` +
        `<div class="grade-2">${cartao('Distribuição das categorias de velocidade', tabVel)}${cartao('Velocidade por equipamento', grafVel)}</div>` +
        cartao(
          'O que os dados mostram',
          conclusao +
            texto(`<h4>Diferenças que podem ser afirmadas diretamente a partir do arquivo</h4>${ul(achados)}<h4>O que não pode ser afirmado</h4>${ul(limites)}`)
        );
    }

    return (
      cab('Distribuição de velocidade por tipo de veículo', 'Como cada tipo de veículo se distribui pelas categorias de velocidade e se esse perfil se repete nos diferentes pontos monitorados.') +
      parteA +
      parteB
    );
  };

  /* =====================================================================
   * ABA 4 — Variação temporal do tráfego
   * ===================================================================== */
  AB.temporal = function (linhas, ctx) {
    const total = A.total(linhas);
    if (!total) return cab('Variação temporal do tráfego') + aviso('Não há registros no recorte selecionado.');
    const st = seriesTipos(ctx);
    const T = ctx.tipos;
    const S = A.SEMANA;

    // Média diária por dia da semana = volume do dia da semana ÷ nº de datas distintas daquele dia.
    const datasDow = A.datasPor(linhas, (r) => r.dow);
    const volDow = A.agrupar(linhas, (r) => r.dow);
    const tipoDow = A.cruzar(linhas, (r) => r.dow, (r) => r.tipo);
    const dias = S.map((d) => {
      const n = (datasDow.get(d) || new Set()).size;
      const vol = volDow.get(d) || 0;
      const porTipo = T.map((t) => ((tipoDow.get(d) || new Map()).get(t) || 0));
      return { d, n, vol, media: n ? vol / n : NaN, porTipo, mediaTipo: porTipo.map((v) => (n ? v / n : NaN)) };
    }).filter((x) => x.n > 0);
    if (dias.length < 2) return cab('Variação temporal do tráfego') + aviso('São necessários registros em pelo menos dois dias da semana.');

    const porD = new Map(dias.map((x) => [x.d, x]));
    const maior = dias.reduce((a, x) => (x.media > a.media ? x : a));
    const menor = dias.reduce((a, x) => (x.media < a.media ? x : a));

    // Transições entre dias consecutivos (inclui domingo → segunda).
    const trans = [];
    for (let i = 0; i < S.length; i++) {
      const de = porD.get(S[i]), para = porD.get(S[(i + 1) % S.length]);
      if (de && para) trans.push({ de, para, varPct: A.pct(para.media - de.media, de.media) });
    }
    const maiorAum = trans.reduce((a, t) => (!a || t.varPct > a.varPct ? t : a), null);
    const anterior = (x) => trans.find((t) => t.para === x);

    const minN = Math.min(...dias.map((x) => x.n)), maxN = Math.max(...dias.map((x) => x.n));
    const tabDias = tabela(
      [{ t: 'Dia da semana' }, { t: 'Dias no período', num: true }, { t: 'Volume acumulado', num: true }, { t: 'Média diária', num: true }, { t: 'Variação sobre o dia anterior', num: true }],
      dias.map((x) => {
        const t = anterior(x);
        return {
          cls: x === maior || x === menor ? 'realce' : '',
          cel: [
            b(A.DIAS[x.d]) + (x === maior ? '<span class="etiqueta-alerta" style="color:var(--sucesso);background:transparent">maior média</span>' : x === menor ? '<span class="etiqueta-alerta" style="background:transparent">menor média</span>' : ''),
            F.n(x.n), F.n(x.vol), b(F.n(x.media)),
            t ? `<span class="${t.varPct > 0 ? 'pos' : 'neg'}">${F.var(t.varPct)}</span><small>vs ${A.DIAS_CURTO[t.de.d]}</small>` : '–',
          ],
        };
      })
    );
    const grafDias = G.colunas(
      dias.map((x) => ({ rotulo: A.DIAS_CURTO[x.d], valor: x.media, texto: F.n(x.media), tip: `<b>${A.DIAS[x.d]}</b><br>Média diária: ${F.n(x.media)} veículos<br>${F.n(x.n)} dias no período` })),
      st[0].cor
    );

    const respostas =
      resposta('Maior volume médio diário', `${A.DIAS[maior.d]}: ${F.n(maior.media)} veículos por dia`, `${F.var(A.pct(maior.media - menor.media, menor.media))} em relação ao dia de menor média.`) +
      resposta('Menor volume médio diário', `${A.DIAS[menor.d]}: ${F.n(menor.media)} veículos por dia`) +
      (maiorAum
        ? resposta(
            'Maior aumento percentual entre dias consecutivos',
            `${A.DIAS[maiorAum.de.d]} → ${A.DIAS[maiorAum.para.d]}: ${F.var(maiorAum.varPct)}`,
            `De ${F.n(maiorAum.de.media)} para ${F.n(maiorAum.para.media)} veículos por dia. Demais transições: ${trans
              .filter((t) => t !== maiorAum)
              .map((t) => `${A.DIAS_CURTO[t.de.d]}→${A.DIAS_CURTO[t.para.d]} ${F.var(t.varPct)}`)
              .join(' · ')}.` +
              (() => {
                // maior aumento sem considerar a virada domingo → segunda
                const dentro = trans.filter((t) => !(t.de.d === 0 && t.para.d === 1));
                const m = dentro.reduce((a, t) => (!a || t.varPct > a.varPct ? t : a), null);
                return m && m !== maiorAum && m.varPct > 0
                  ? ` Considerando apenas as transições de segunda a domingo, o maior aumento é ${A.DIAS_CURTO[m.de.d]}→${A.DIAS_CURTO[m.para.d]} (${F.var(m.varPct)}).`
                  : '';
              })()
          )
        : '');

    /* ----- Dias úteis × fim de semana ----- */
    const grupo = (d) => (d === 0 || d === 6 ? 'fds' : 'uteis');
    const g = { uteis: { n: 0, vt: T.map(() => 0) }, fds: { n: 0, vt: T.map(() => 0) } };
    dias.forEach((x) => {
      const k = grupo(x.d);
      g[k].n += x.n;
      x.porTipo.forEach((v, i) => (g[k].vt[i] += v));
    });
    const temAmbos = g.uteis.n > 0 && g.fds.n > 0;
    let blocoPerfil = '';
    let blocoAumento = '';
    if (temAmbos) {
      ['uteis', 'fds'].forEach((k) => {
        g[k].tot = g[k].vt.reduce((a, c) => a + c, 0);
        g[k].pct = g[k].vt.map((v) => A.pct(v, g[k].tot));
        g[k].media = g[k].vt.map((v) => v / g[k].n);
        g[k].mediaTot = g[k].tot / g[k].n;
      });
      const difs = T.map((t, i) => ({ t, i, d: g.fds.pct[i] - g.uteis.pct[i], v: A.pct(g.fds.media[i] - g.uteis.media[i], g.uteis.media[i]) }));
      const maiorDif = difs.reduce((a, x) => (Math.abs(x.d) > Math.abs(a.d) ? x : a));
      const muda = Math.abs(maiorDif.d) >= 1;
      const tabPerfil = tabela(
        [{ t: 'Tipo' }, { t: 'Dias úteis: média diária', num: true }, { t: 'Dias úteis: %', num: true }, { t: 'Fim de semana: média diária', num: true }, { t: 'Fim de semana: %', num: true }, { t: 'Diferença de participação', num: true }, { t: 'Variação da média diária', num: true }],
        difs
          .map((x) => ({
            cel: [
              `<i class="marca-th" style="background:${st[x.i].cor}"></i>${esc(x.t)}`,
              F.n(g.uteis.media[x.i]), F.p(g.uteis.pct[x.i]), F.n(g.fds.media[x.i]), F.p(g.fds.pct[x.i]),
              `<span class="${ppClasse(x.d)}">${F.pp(x.d)}</span>`, `<span class="${ppClasse(x.v)}">${F.var(x.v)}</span>`,
            ],
          }))
          .concat([{ cls: 'total', cel: ['Total', F.n(g.uteis.mediaTot), '100,0%', F.n(g.fds.mediaTot), '100,0%', '', F.var(A.pct(g.fds.mediaTot - g.uteis.mediaTot, g.uteis.mediaTot))] }])
      );
      const sobe = difs.filter((x) => x.d >= 0.5), desce = difs.filter((x) => x.d <= -0.5);
      blocoPerfil = cartao(
        'Perfil de tipos de veículos: dias úteis × fim de semana',
        resposta(
          'O perfil de tipos de veículos muda entre dias úteis e finais de semana?',
          muda ? 'Sim, a composição muda.' : 'Pouco: as participações variam menos de 1 p.p.',
          `${desce.length ? `Perdem participação no fim de semana: ${F.lista(desce.map((x) => `${esc(x.t)} (${F.p(g.uteis.pct[x.i])} → ${F.p(g.fds.pct[x.i])}, ${F.pp(x.d)})`))}. ` : ''}` +
            `${sobe.length ? `Ganham participação: ${F.lista(sobe.map((x) => `${esc(x.t)} (${F.p(g.uteis.pct[x.i])} → ${F.p(g.fds.pct[x.i])}, ${F.pp(x.d)})`))}.` : ''}`
        ) +
          `<div class="grade-2" style="margin:14px 0 0">${'<div>' + G.barras100(
            [
              { rotulo: 'Dias úteis', sub: 'seg. a sex.', valores: g.uteis.vt },
              { rotulo: 'Fim de semana', sub: 'sáb. e dom.', valores: g.fds.vt },
            ],
            st
          ) + '</div>'}<div>${tabPerfil}</div></div>`,
        'Médias diárias calculadas sobre o número de datas de cada grupo; participação = parcela de cada tipo no volume do grupo.'
      );

      /* ----- O aumento do fim da semana é explicado igualmente por todos os tipos? ----- */
      const BASE = [1, 2, 3, 4].filter((d) => porD.has(d));
      const FIM = [5, 6, 0].filter((d) => porD.has(d));
      if (BASE.length && FIM.length) {
        const nBase = BASE.reduce((s, d) => s + porD.get(d).n, 0);
        const mBase = T.map((t, i) => BASE.reduce((s, d) => s + porD.get(d).porTipo[i], 0) / nBase);
        const mBaseTot = mBase.reduce((a, c) => a + c, 0);
        const fins = FIM.map((d) => {
          const x = porD.get(d);
          const tot = x.mediaTipo.reduce((a, c) => a + c, 0);
          return { x, tot, varTot: A.pct(tot - mBaseTot, mBaseTot), varTipo: x.mediaTipo.map((m, i) => A.pct(m - mBase[i], mBase[i])), delta: x.mediaTipo.map((m, i) => m - mBase[i]) };
        });
        const pico = fins.reduce((a, f) => (f.varTot > a.varTot ? f : a));
        const tabAum = tabela(
          [{ t: 'Tipo' }, { t: 'Média seg.–qui.', num: true }, ...fins.map((f) => ({ t: A.DIAS[f.x.d], num: true })), ...(pico.varTot > 0 ? [{ t: `Parcela do aumento (${A.DIAS_CURTO[pico.x.d]})`, num: true }] : [])],
          T.map((t, i) => ({
            cel: [
              `<i class="marca-th" style="background:${st[i].cor}"></i>${esc(t)}`, F.n(mBase[i]),
              ...fins.map((f) => `${F.n(f.x.mediaTipo[i])}<small class="${ppClasse(f.varTipo[i])}">${F.var(f.varTipo[i])}</small>`),
              ...(pico.varTot > 0 ? [F.p(A.pct(pico.delta[i], pico.tot - mBaseTot))] : []),
            ],
          })).concat([
            {
              cls: 'total',
              cel: ['Total', F.n(mBaseTot), ...fins.map((f) => `${F.n(f.tot)}<small class="${ppClasse(f.varTot)}">${F.var(f.varTot)}</small>`), ...(pico.varTot > 0 ? ['100,0%'] : [])],
            },
          ])
        );

        let resp, det;
        const relevantes = T.map((t, i) => i).filter((i) => A.pct(mBase[i], mBaseTot) >= 1);
        if (pico.varTot > 0) {
          const vs = relevantes.map((i) => pico.varTipo[i]);
          const igual = Math.max(...vs) - Math.min(...vs) < 5;
          const ord = [...relevantes].sort((a, c) => pico.delta[c] - pico.delta[a]);
          const princ = ord[0];
          resp = igual ? 'Sim, de forma aproximadamente proporcional entre os tipos.' : 'Não. O aumento não é distribuído igualmente entre os tipos de veículos.';
          det =
            `Na ${A.DIAS[pico.x.d].toLowerCase()}, dia de maior volume do fim da semana, a média diária fica ${F.var(pico.varTot)} acima da média de segunda a quinta. ` +
            `${esc(T[princ])} responde por ${F.p(A.pct(pico.delta[princ], pico.tot - mBaseTot))} do acréscimo (${F.var(pico.varTipo[princ])}), enquanto ` +
            F.lista(ord.slice(1).map((i) => `${esc(T[i])} varia ${F.var(pico.varTipo[i])}`)) +
            '.' +
            (A.pct(pico.delta[princ], pico.tot - mBaseTot) > 100 ? ` A parcela de ${esc(T[princ])} passa de 100% porque outros tipos diminuem nesse dia: o aumento líquido é menor que o acréscimo desse tipo.` : '') +
            ' Se o aumento fosse igual para todos, cada tipo cresceria o mesmo percentual e contribuiria na proporção da sua participação.';
        } else {
          resp = 'Não há aumento no fim da semana em relação a segunda–quinta neste recorte.';
          det = '';
        }
        const outros = fins.filter((f) => f !== pico).map((f) => {
          const sobem = T.filter((t, i) => f.varTipo[i] > 0.5 && relevantes.includes(i));
          const caem = T.filter((t, i) => f.varTipo[i] < -0.5 && relevantes.includes(i));
          return `${b(A.DIAS[f.x.d])}: total ${F.var(f.varTot)} sobre seg.–qui.${caem.length ? `; caem ${F.lista(caem.map((t) => `${esc(t)} (${F.var(f.varTipo[T.indexOf(t)])})`))}` : ''}${sobem.length ? `; sobem ${F.lista(sobem.map((t) => `${esc(t)} (${F.var(f.varTipo[T.indexOf(t)])})`))}` : ''}.`;
        });

        blocoAumento = cartao(
          'O aumento do fim da semana é explicado igualmente por todos os tipos?',
          resposta('O aumento do volume ao final da semana é explicado igualmente por todas as categorias de veículos?', resp, det) +
            tabAum +
            (outros.length ? texto(`<h4>Demais dias do fim da semana</h4>${ul(outros)}`) : ''),
          'Base de comparação: média diária de segunda a quinta-feira. Abaixo de cada média: variação percentual sobre essa base.'
        );
      }
    }

    /* ----- Série mensal ----- */
    const volMes = A.agrupar(linhas, (r) => r.mes);
    const datasMes = A.datasPor(linhas, (r) => r.mes);
    const eqMes = new Map();
    for (const r of linhas) {
      let s = eqMes.get(r.mes);
      if (!s) eqMes.set(r.mes, (s = new Set()));
      s.add(r.eq);
    }
    const meses = [...volMes.keys()].sort();
    const todosMeses = [];
    if (meses.length) {
      let [a, m] = meses[0].split('-').map(Number);
      const [af, mf] = meses[meses.length - 1].split('-').map(Number);
      while (a < af || (a === af && m <= mf)) {
        todosMeses.push(`${a}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; a++; }
      }
    }
    // Conjunto de equipamentos mais frequente entre os meses: serve de referência para apontar mudanças.
    const freqConj = new Map();
    for (const s of eqMes.values()) {
      const k = [...s].sort().join(', ');
      freqConj.set(k, (freqConj.get(k) || 0) + 1);
    }
    const conjTipico = [...freqConj.entries()].sort((a, c) => c[1] - a[1])[0][0];
    const pontos = todosMeses.map((k) => {
      const n = (datasMes.get(k) || new Set()).size;
      const v = n ? volMes.get(k) / n : null;
      const eqsM = eqMes.get(k) ? [...eqMes.get(k)].sort() : [];
      return { chave: k, rotulo: F.mes(k), valor: v, n, eqs: eqsM, tip: v == null ? '' : `<b>${F.mes(k)}</b><br>Média diária: ${F.n(v)} veículos<br>${n} dias com registro<br>Equipamentos: ${eqsM.map(esc).join(', ')}` };
    });
    const validos = pontos.filter((p) => p.valor != null);
    const pMax = validos.reduce((a, p) => (p.valor > a.valor ? p : a));
    const pMin = validos.reduce((a, p) => (p.valor < a.valor ? p : a));
    const mesesAtipicos = validos.filter((p) => p.eqs.join(', ') !== conjTipico);
    // agrupa meses consecutivos com o mesmo conjunto de equipamentos
    const blocosAtipicos = [];
    mesesAtipicos.forEach((p) => {
      const ult = blocosAtipicos[blocosAtipicos.length - 1];
      const idx = todosMeses.indexOf(p.chave);
      if (ult && ult.conj === p.eqs.join(', ') && ult.idxFim === idx - 1) { ult.fim = p.chave; ult.idxFim = idx; }
      else blocosAtipicos.push({ ini: p.chave, fim: p.chave, idxFim: idx, conj: p.eqs.join(', ') });
    });
    const semDados = pontos.filter((p) => p.valor == null);
    const serie = cartao(
      'Média diária por mês',
      G.linha(pontos, { titulo: 'Média diária de veículos por mês', cadaX: 6 }) +
        texto(
          ul(
            [
              `Maior média mensal: ${F.mes(pMax.chave)} (${F.n(pMax.valor)} veículos/dia). Menor: ${F.mes(pMin.chave)} (${F.n(pMin.valor)} veículos/dia).`,
              semDados.length
                ? semDados.length === 1
                  ? `${F.mes(semDados[0].chave)} não tem nenhum registro e aparece como interrupção na linha.`
                  : `${F.n(semDados.length)} meses não têm nenhum registro e aparecem como interrupções na linha: ${F.lista(semDados.map((p) => F.mes(p.chave)))}.`
                : '',
              mesesAtipicos.length
                ? `Na maior parte dos meses registram dados os equipamentos ${esc(conjTipico)}. ${F.plural(mesesAtipicos.length, 'mês tem', 'meses têm')} um conjunto diferente de equipamentos (${F.lista(
                    blocosAtipicos.slice(0, 8).map((x) => `${x.ini === x.fim ? F.mes(x.ini) : `${F.mes(x.ini)} a ${F.mes(x.fim)}`}: ${esc(x.conj)}`)
                  )}${blocosAtipicos.length > 8 ? ' …' : ''}); mudanças de nível nesses meses podem refletir a entrada ou saída de equipamentos, e não variação do tráfego.`
                : '',
            ].filter(Boolean)
          )
        ),
      'Volume do mês dividido pelo número de dias do mês com registro (soma dos equipamentos do recorte).'
    );

    return (
      cab(
        'Variação temporal do tráfego',
        'Dia da semana derivado de <code>data_da_passagem</code>. As comparações usam a média diária (volume ÷ número de datas daquele dia da semana), e não a soma acumulada.'
      ) +
      `<div class="grade-2">${cartao('Média diária por dia da semana', grafDias, `Cada dia da semana aparece entre ${F.n(minN)} e ${F.n(maxN)} vezes no período.`)}${cartao('Respostas', respostas)}</div>` +
      cartao('Tabela por dia da semana', tabDias) +
      blocoPerfil +
      blocoAumento +
      serie
    );
  };

  /* =====================================================================
   * ABA 5 — Análise espacial e operacional
   * ===================================================================== */
  function comparar(linhas, ctx, campo, nomeDim, rotulo) {
    const total = A.total(linhas);
    const st = seriesTipos(ctx), sv = seriesVel(ctx);
    const grupos = separar(linhas, campo).map((g) => ({
      chave: g.chave, rot: rotulo(g.chave),
      eqs: A.distintos(g.linhas, 'eq').sort(), outros: A.distintos(g.linhas, campo === 'sentido' ? 'faixa' : 'sentido'),
      p: perfil(g.linhas, ctx),
    }));
    const geral = perfil(linhas, ctx);
    const outroNome = campo === 'sentido' ? 'Faixa(s)' : 'Sentido(s)';

    const tabVol = tabela(
      [{ t: nomeDim }, { t: 'Equipamentos' }, { t: outroNome }, { t: 'Dias com dados', num: true }, { t: 'Volume', num: true }, { t: '% do total', num: true }, { t: 'Média diária', num: true }],
      grupos.map((g) => ({ cel: [b(esc(g.rot)), g.eqs.map(esc).join(', '), g.outros.map(esc).join(', '), F.n(g.p.dias), F.n(g.p.total), F.p(A.pct(g.p.total, total)), F.n(g.p.mediaDia)] }))
    );
    const tabTipo = tabela(
      [{ t: nomeDim }, ...ctx.tipos.map((t, i) => ({ t: esc(t), num: true, cor: st[i].cor }))],
      grupos.map((g) => ({ cel: [b(esc(g.rot)), ...g.p.tipoPct.map((p, i) => `${F.p(p)}<small>${F.pp(p - geral.tipoPct[i])}</small>`)] }))
    );
    const tabVel = tabela(
      [{ t: nomeDim }, ...ctx.vels.map((v, i) => ({ t: esc(v.rotulo), num: true, cor: sv[i].cor })), { t: '> 100 km/h por 10 mil', num: true }],
      grupos.map((g) => ({ cel: [b(esc(g.rot)), ...g.p.velPct.map(F.pa), porDezMil(g.p.acima100Pct)] }))
    );

    const achados = [];
    if (grupos.length > 1) {
      const ord = [...grupos].sort((a, c) => c.p.mediaDia - a.p.mediaDia);
      achados.push(
        `${b('Volume')}: ${F.lista(ord.map((g) => `${esc(g.rot)} ${F.n(g.p.mediaDia)} veíc./dia (${F.p(A.pct(g.p.total, total))} do volume)`))}.`
      );
      ctx.tipos.forEach((t, i) => {
        const ps = grupos.map((g) => g.p.tipoPct[i]);
        const amp = Math.max(...ps) - Math.min(...ps);
        if (amp >= 2) achados.push(`${b(esc(t))}: ${F.lista(grupos.map((g) => `${F.p(g.p.tipoPct[i])} em ${esc(g.rot)}`))} (diferença de ${F.dec(amp, 1)} p.p.).`);
      });
      const modais = grupos.map((g) => indiceModal(g.p.velVol));
      achados.push(
        `${b('Velocidade')}: categoria mais frequente ${F.lista(grupos.map((g, k) => `${esc(ctx.vels[modais[k]].rotulo)} em ${esc(g.rot)} (${F.p(g.p.velPct[modais[k]])})`))}; ` +
          `${esc(ctx.vels[0].rotulo)}: ${F.lista(grupos.map((g) => `${F.p(g.p.velPct[0])} em ${esc(g.rot)}`))}; acima de 100 km/h: ${F.lista(grupos.map((g) => `${porDezMil(g.p.acima100Pct)} por 10 mil em ${esc(g.rot)}`))}.`
      );
    }

    return {
      grupos,
      html:
        cartao(`Volume por ${nomeDim.toLowerCase()}`, tabVol) +
        `<div class="grade-2">${cartao(
          `Composição dos veículos por ${nomeDim.toLowerCase()}`,
          G.barras100(grupos.map((g) => ({ rotulo: g.rot, valores: g.p.tipoVol })), st) + '<div style="height:12px"></div>' + tabTipo,
          'Abaixo de cada percentual: diferença em relação ao conjunto.'
        )}${cartao(
          `Distribuição das velocidades por ${nomeDim.toLowerCase()}`,
          G.barras100(grupos.map((g) => ({ rotulo: g.rot, valores: g.p.velVol })), sv, { limiteRotulo: 8 }) + '<div style="height:12px"></div>' + tabVel
        )}</div>` +
        (achados.length ? cartao(`Comparação entre ${campo === 'sentido' ? 'sentidos' : 'faixas'}`, texto(ul(achados))) : ''),
    };
  }

  AB.espacial = function (linhas, ctx) {
    const total = A.total(linhas);
    if (!total) return cab('Análise espacial e operacional') + aviso('Não há registros no recorte selecionado.');

    const sent = comparar(linhas, ctx, 'sentido', 'Sentido', (k) => k);
    const fx = comparar(linhas, ctx, 'faixa', 'Faixa', (k) => `Faixa ${k}`);

    // Relações entre sentido, faixa e equipamento (confundimento)
    const avisos = [];
    const sentPorFaixa = fx.grupos.map((g) => g.outros.length);
    const faixaPorSent = sent.grupos.map((g) => g.outros.length);
    if (sent.grupos.length > 1 && fx.grupos.length > 1 && sentPorFaixa.every((n) => n === 1) && faixaPorSent.every((n) => n === 1)) {
      avisos.push(
        `Neste arquivo, ${F.lista(fx.grupos.map((g) => `a ${esc(g.rot.toLowerCase())} só ocorre no sentido ${esc(g.outros[0])}`))}. As comparações por sentido e por faixa são, na prática, a mesma comparação: não é possível separar o efeito da faixa do efeito do sentido.`
      );
    }
    sent.grupos.forEach((g) => {
      if (g.eqs.length === 1 && sent.grupos.length > 1)
        avisos.push(`O sentido ${esc(g.rot)} é registrado apenas pelo equipamento ${esc(g.eqs[0])}; diferenças entre sentidos também refletem diferenças entre pontos da rodovia.`);
    });
    const faixasPorEq = separar(linhas, 'eq').map((g) => A.distintos(g.linhas, 'faixa').length);
    if (faixasPorEq.every((n) => n === 1) && fx.grupos.length > 1)
      avisos.push('Cada equipamento registra uma única faixa, portanto o arquivo não permite comparar faixas diferentes em um mesmo ponto.');

    /* ----- Rankings acima de 100 km/h ----- */
    const acimaCats = ctx.vels.filter(A.acima100);
    const eqs = separar(linhas, 'eq', ctx.equipamentos.map((e) => e.id)).map((g) => {
      const porVel = A.agrupar(g.linhas, (r) => r.vel);
      const p = perfil(g.linhas, ctx);
      return { id: g.chave, info: ctx.equipamentos.find((e) => e.id === g.chave), p, porCat: acimaCats.map((v) => porVel.get(v.bruto) || 0) };
    });
    const porAbs = [...eqs].sort((a, c) => c.p.acima100 - a.p.acima100 || c.p.acima100Pct - a.p.acima100Pct);
    const porProp = [...eqs].sort((a, c) => c.p.acima100Pct - a.p.acima100Pct || c.p.acima100 - a.p.acima100);
    const rankAbs = new Map(porAbs.map((e, i) => [e.id, i + 1]));
    const rankProp = new Map(porProp.map((e, i) => [e.id, i + 1]));
    const st = seriesTipos(ctx);

    let blocoRanking = '';
    if (!acimaCats.length) {
      blocoRanking = cartao('Veículos acima de 100 km/h', aviso('O arquivo não possui categorias de velocidade acima de 100 km/h.'));
    } else {
      const tab = tabela(
        [
          { t: 'Equipamento' }, { t: 'Dias com dados', num: true }, { t: 'Volume total', num: true },
          ...acimaCats.map((v) => ({ t: esc(v.rotulo), num: true })),
          { t: 'Total > 100 km/h', num: true }, { t: 'Proporção', num: true }, { t: 'Por 10 mil', num: true }, { t: 'Média diária > 100', num: true },
          { t: 'Posição (absoluto)', num: true }, { t: 'Posição (proporção)', num: true },
        ],
        porAbs.map((e) => ({
          cls: rankAbs.get(e.id) === 1 || rankProp.get(e.id) === 1 ? 'realce' : '',
          cel: [
            b(esc(e.id)), F.n(e.p.dias), F.n(e.p.total), ...e.porCat.map(F.n), b(F.n(e.p.acima100)), F.pa(e.p.acima100Pct), porDezMil(e.p.acima100Pct),
            F.dec(e.p.acima100 / e.p.dias, 2), `${rankAbs.get(e.id)}º`, `${rankProp.get(e.id)}º`,
          ],
        }))
      );
      const grafAbs = G.barrasH(
        porAbs.map((e) => ({ rotulo: e.id, valor: e.p.acima100, texto: `${F.n(e.p.acima100)} veíc.`, tip: `<b>${esc(e.id)}</b><br>${F.n(e.p.acima100)} veículos acima de 100 km/h<br>de ${F.n(e.p.total)} no total` })),
        st[0].cor
      );
      const grafProp = G.barrasH(
        porProp.map((e) => ({ rotulo: e.id, valor: e.p.acima100Pct, texto: `${F.pa(e.p.acima100Pct)} · ${porDezMil(e.p.acima100Pct)}/10 mil`, tip: `<b>${esc(e.id)}</b><br>${F.pa(e.p.acima100Pct)} do volume do equipamento<br>${F.n(e.p.acima100)} de ${F.n(e.p.total)} veículos` })),
        st[1].cor
      );

      const a1 = porAbs[0], p1 = porProp[0];
      const rotCats = F.lista(acimaCats.map((v) => esc(v.rotulo)));
      let explicaDados;
      if (a1.id !== p1.id) {
        explicaDados =
          `Neste arquivo os dois rankings têm líderes diferentes. ${b(esc(a1.id))} lidera em quantidade porque é também um equipamento de grande volume total (${F.n(a1.p.total)} veículos, ${F.p(A.pct(a1.p.total, total))} do recorte): ` +
          `mesmo uma proporção baixa (${F.pa(a1.p.acima100Pct)}, ${porDezMil(a1.p.acima100Pct)} a cada 10 mil) aplicada a uma base grande produz ${F.n(a1.p.acima100)} veículos. ` +
          `${b(esc(p1.id))} tem apenas ${F.n(p1.p.acima100)} veículos acima de 100 km/h, mas sobre uma base de ${F.n(p1.p.total)} veículos; a proporção resultante (${F.pa(p1.p.acima100Pct)}) é ${F.dec(p1.p.acima100Pct / a1.p.acima100Pct, 1)} vezes a de ${esc(a1.id)}.`;
      } else {
        explicaDados = `Neste recorte, ${b(esc(a1.id))} lidera os dois rankings, mas as posições dos demais equipamentos podem diferir entre as duas medidas (veja a tabela).`;
      }
      const diasDif = Math.max(...eqs.map((e) => e.p.dias)) > 1.5 * Math.min(...eqs.map((e) => e.p.dias));
      const pequenaBase = porProp.filter((e) => e.p.total < 0.05 * total);

      blocoRanking =
        `<div class="cabeca-aba" style="margin-top:28px"><h2>Veículos acima de 100 km/h por equipamento</h2><p>Categorias consideradas: ${rotCats}.</p></div>` +
        `<div class="grade-2">${cartao(
          'Maior volume absoluto',
          resposta('Qual equipamento possui o maior volume absoluto de veículos acima de 100 km/h?', `${esc(a1.id)}: ${F.n(a1.p.acima100)} veículos`, `km ${F.dec(a1.info.km, 0)}, ${esc(a1.info.mun)} · ${F.pa(a1.p.acima100Pct)} do seu volume`) + grafAbs
        )}${cartao(
          'Maior proporção sobre o próprio volume',
          resposta('Qual equipamento possui a maior proporção de veículos acima de 100 km/h?', `${esc(p1.id)}: ${F.pa(p1.p.acima100Pct)} do seu volume`, `${porDezMil(p1.p.acima100Pct)} a cada 10 mil veículos · ${F.n(p1.p.acima100)} de ${F.n(p1.p.total)} veículos`) + grafProp
        )}</div>` +
        cartao('Detalhamento por equipamento', tab, 'Linhas destacadas: líderes de cada ranking. As duas medidas são mostradas em gráficos separados porque têm escalas e significados diferentes.') +
        cartao(
          'Por que os rankings diferem',
          texto(
            `<p>${explicaDados}</p>
            ${ul([
              `${b('Quantidade absoluta')} responde “onde passaram mais veículos acima de 100 km/h”. Ela depende do tamanho da base: quanto mais veículos um equipamento registra (e quanto mais dias ele opera), maior tende a ser a contagem, mesmo que o comportamento de velocidade seja igual.`,
              `${b('Proporção')} responde “que parcela dos veículos que passam por aquele ponto está acima de 100 km/h”. Ela elimina o efeito do tamanho da base e descreve a frequência relativa do fenômeno em cada ponto.`,
              `As duas medidas não são intercambiáveis: um ponto pode concentrar a maior quantidade de veículos rápidos e, ao mesmo tempo, ter uma das menores proporções, e vice-versa. Ordenar por uma e interpretar como a outra leva a conclusões erradas sobre onde a ocorrência é mais frequente.`,
              diasDif
                ? `Os equipamentos têm períodos de dados diferentes (de ${F.n(Math.min(...eqs.map((e) => e.p.dias)))} a ${F.n(Math.max(...eqs.map((e) => e.p.dias)))} dias), o que afeta diretamente a contagem absoluta. A coluna “Média diária > 100” e o filtro “Período comum a todos os equipamentos” ajudam a separar esse efeito.`
                : '',
              pequenaBase.length
                ? `Proporções calculadas sobre bases menores são mais sensíveis a poucos registros: ${F.lista(pequenaBase.map((e) => `${esc(e.id)} (${F.n(e.p.total)} veículos no total)`))}.`
                : '',
            ].filter(Boolean))}`
          )
        );
    }

    return (
      cab('Análise espacial e operacional', 'Comparação entre sentidos de circulação e faixas da pista (volume, composição e velocidades) e ranking dos equipamentos nas categorias acima de 100 km/h.') +
      (avisos.length ? cartao('Antes de comparar', texto(avisos.map(aviso).join(''))) : '') +
      `<div class="cabeca-aba" style="margin-top:8px"><h2>Sentidos de circulação</h2></div>` +
      sent.html +
      `<div class="cabeca-aba" style="margin-top:28px"><h2>Faixas da pista</h2></div>` +
      fx.html +
      blocoRanking
    );
  };
})();
