/* Inicialização: carregamento dos dados, filtros globais e navegação entre abas. */
(function () {
  const R = window.Radar;
  const A = R.analise, F = R.fmt;

  const ABAS = ['caracterizacao', 'composicao', 'distribuicao', 'temporal', 'espacial'];
  const estado = { aba: 'caracterizacao', periodo: 'completo', equipamento: 'todos' };
  let base = null; // { linhas, ctx, meta }

  const $ = (s) => document.querySelector(s);
  const conteudo = $('#conteudo');

  function linhasFiltradas() {
    let l = base.linhas;
    if (estado.periodo === 'comum' && base.ctx.periodoComum) {
      const { ini, fim } = base.ctx.periodoComum;
      l = l.filter((r) => r.dn >= ini && r.dn <= fim);
    }
    if (estado.equipamento !== 'todos') l = l.filter((r) => r.eq === estado.equipamento);
    return l;
  }

  function renderizar() {
    if (!base) return;
    document.querySelectorAll('.abas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba)));
    const linhas = linhasFiltradas();
    try {
      conteudo.innerHTML = linhas.length
        ? R.abas[estado.aba](linhas, base.ctx, base.meta)
        : '<div class="aviso"><div>Nenhum registro no recorte selecionado.</div></div>';
    } catch (e) {
      console.error(e);
      conteudo.innerHTML = `<div class="aviso"><div>Erro ao montar a análise: ${F.esc(e.message)}</div></div>`;
    }
  }

  function atualizarCabecalho() {
    const { ctx, linhas, meta } = base;
    const rods = A.distintos(linhas, 'rod');
    const conc = A.distintos(linhas, 'conc');
    $('#titulo-rodovia').textContent = `Radares de velocidade — ${rods.join(', ')}${conc.length === 1 ? ` (${conc[0].charAt(0) + conc[0].slice(1).toLowerCase()})` : ''}`;
    const dmin = Math.min(...ctx.equipamentos.map((e) => e.dnMin));
    const dmax = Math.max(...ctx.equipamentos.map((e) => e.dnMax));
    $('#resumo-fonte').textContent = `${meta.nome} · ${F.n(linhas.length)} registros · ${F.data(F.chaveDia(dmin))} a ${F.data(F.chaveDia(dmax))}`;

    const sel = $('#f-equip');
    sel.innerHTML =
      '<option value="todos">Todos</option>' +
      ctx.equipamentos.map((e) => `<option value="${F.esc(e.id)}">${F.esc(e.id)} — km ${F.dec(e.km, 0)} (${F.esc(e.mun)})</option>`).join('');

    const per = $('#f-periodo');
    const opt = per.querySelector('option[value="comum"]');
    if (ctx.periodoComum) {
      opt.disabled = false;
      opt.textContent = `Comum a todos os equipamentos (${F.data(F.chaveDia(ctx.periodoComum.ini))} a ${F.data(F.chaveDia(ctx.periodoComum.fim))})`;
    } else {
      opt.disabled = true;
      opt.textContent = 'Comum a todos os equipamentos (inexistente)';
    }
    // Filtros iniciais opcionais pela URL: ?periodo=comum&equip=LE-89
    const q = new URLSearchParams(location.search);
    estado.periodo = q.get('periodo') === 'comum' && ctx.periodoComum ? 'comum' : 'completo';
    estado.equipamento = ctx.equipamentos.some((e) => e.id === q.get('equip')) ? q.get('equip') : 'todos';
    per.value = estado.periodo;
    sel.value = estado.equipamento;
  }

  function carregarTexto(texto, nome) {
    const { linhas, descartadas } = R.leitor.interpretar(texto);
    if (!linhas.length) throw new Error('O arquivo não contém registros válidos.');
    base = { linhas, ctx: A.contexto(linhas), meta: { nome, descartadas } };
    atualizarCabecalho();
    renderizar();
  }

  function telaSemDados(msg) {
    conteudo.innerHTML = `<div class="erro-carga">
      <h2>Não foi possível carregar os dados</h2>
      <p>${F.esc(msg)}</p>
      <p>Selecione o arquivo <code>volume-radar-trans.csv</code> manualmente:</p>
      <label class="botao-arquivo">Escolher arquivo CSV<input type="file" accept=".csv,text/csv" id="f-arquivo-2"></label>
    </div>`;
    $('#f-arquivo-2').addEventListener('change', (ev) => lerArquivo(ev.target.files[0]));
  }

  function lerArquivo(arq) {
    if (!arq) return;
    conteudo.innerHTML = '<div class="carregando"><div class="spinner" aria-hidden="true"></div>Processando arquivo…</div>';
    arq.arrayBuffer().then((buf) => {
      try {
        carregarTexto(R.leitor.decodificar(buf), arq.name);
      } catch (e) {
        telaSemDados(e.message);
      }
    });
  }

  function lerHash() {
    const h = location.hash.replace('#', '');
    if (ABAS.includes(h)) estado.aba = h;
  }

  async function iniciar() {
    R.graficos.iniciarTooltip();
    lerHash();

    document.querySelectorAll('.abas button').forEach((b) =>
      b.addEventListener('click', () => {
        estado.aba = b.dataset.aba;
        history.replaceState(null, '', '#' + estado.aba);
        renderizar();
        conteudo.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      })
    );
    window.addEventListener('hashchange', () => { lerHash(); renderizar(); });
    $('#f-periodo').addEventListener('change', (ev) => { estado.periodo = ev.target.value; renderizar(); });
    $('#f-equip').addEventListener('change', (ev) => { estado.equipamento = ev.target.value; renderizar(); });
    $('#f-arquivo').addEventListener('change', (ev) => lerArquivo(ev.target.files[0]));
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', renderizar);

    // 1) dados embutidos (data/dados.js) — funciona inclusive abrindo o HTML direto do disco
    // 2) busca do CSV (servidor local / Vercel)
    // 3) seleção manual do arquivo
    await new Promise((r) => setTimeout(r, 0)); // deixa o navegador pintar o aviso de carregamento
    try {
      if (typeof window.RADAR_CSV === 'string') {
        const t = window.RADAR_CSV;
        delete window.RADAR_CSV;
        carregarTexto(t, 'volume-radar-trans.csv');
        return;
      }
      const resp = await fetch('data/volume-radar-trans.csv');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      carregarTexto(R.leitor.decodificar(await resp.arrayBuffer()), 'volume-radar-trans.csv');
    } catch (e) {
      telaSemDados(`O arquivo de dados não foi encontrado (${e.message}).`);
    }
  }

  iniciar();
})();
