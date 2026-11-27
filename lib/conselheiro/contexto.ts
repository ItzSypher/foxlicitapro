import type { FichaEdital } from "@/core/ficha";
import { NAO_INFORMADO, NOME_NATUREZA } from "@/core/ficha";
import type { ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { Fornecedor } from "@/core/fornecedores";
import { ROTULO_REGIAO, type PerfilEmpresa } from "@/core/perfil";
import { ROTULO_CONFIANCA, ROTULO_VEREDITO, type PrecoSugerido } from "@/core/preco-sugerido";
import { normalizarTexto } from "@/core/texto-busca";
import type { OportunidadeComScore } from "@/core/types";
import type { ItemCompra } from "@/core/types-detalhe";
import { textoPerfil } from "@/lib/assistente/prompt";
import { caminhoDoDinheiro } from "@/core/caminho-dinheiro";
import { comissaoDoItem, contaLucro, type ContaLucro } from "@/core/lucro";
import { ROTULO_CURTO_TIPO_ACERVO, sugerirDoAcervo, type DocumentoAcervo } from "@/core/acervo";
import type { DadosSoftware } from "@/core/campos-software";
import { casarFoco } from "@/core/cnae-keywords";
import {
  HORAS_POR_MES,
  MARGEM_MINIMA_DONO,
  MINIMO_MENSAL_SOFTWARE,
  VALOR_HORA,
  contaSoftware,
  ehDesenvolvimento,
  tetoDoDev,
  type ContaSoftware,
} from "@/core/custo-software";
import { ATIVIDADE_DA_EMPRESA, avaliarPregao, type RegraPregao } from "./pregao";

/** Texto do contexto enviado ao assistente: dados já calculados pelo sistema, sem rede e sem banco. */

/** Itens da compra que vão no pedido; os demais só entram na contagem. */
export const MAX_ITENS_NO_CONTEXTO = 15;
/** Fornecedores que vão no pedido. */
export const MAX_FORNECEDORES_NO_CONTEXTO = 8;
const MAX_OBJETO = 1500;
const MAX_DOCUMENTOS = 12;
/** Linhas do bloco do acervo (documentos e atestados juntos). */
export const MAX_LINHAS_ACERVO = 10;

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function brl(valor: number | null): string {
  return valor === null ? "não informado" : moeda.format(valor);
}

function cortar(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

/** Palavras de ligação e termos que aparecem em quase todo objeto: não servem para casar fornecedor. */
const SEM_VALOR_NO_CASAMENTO: ReadonlySet<string> = new Set([
  "de", "da", "do", "das", "dos", "para", "com", "sem", "por", "uma", "que", "em", "ao", "aos",
  "servico", "servicos", "aquisicao", "contratacao", "fornecimento", "empresa", "especializada",
  "material", "materiais", "item", "itens", "geral", "diversos", "outros",
]);

/** Início da palavra: junta singular e plural ("licenca" e "licencas"). */
const TAMANHO_RAIZ = 5;

function raizes(texto: string): Set<string> {
  const saida = new Set<string>();
  for (const p of normalizarTexto(texto).split(" ")) {
    if (p.length < 4 || SEM_VALOR_NO_CASAMENTO.has(p)) continue;
    saida.add(p.slice(0, TAMANHO_RAIZ));
  }
  return saida;
}

/**
 * Fornecedores ativos cujas categorias (texto separado por vírgula ou ponto e vírgula) casam com o objeto:
 * a categoria inteira aparece no objeto, ou uma palavra dela (de 4 letras ou mais) aparece. Ordem de entrada mantida.
 */
export function fornecedoresDoObjeto(fornecedores: readonly Fornecedor[], objeto: string): Fornecedor[] {
  const textoObjeto = ` ${normalizarTexto(objeto)} `;
  const raizesObjeto = raizes(objeto);
  return fornecedores.filter((f) => {
    if (!f.ativo) return false;
    for (const categoria of f.categorias.split(/[,;]/)) {
      const limpa = normalizarTexto(categoria);
      if (limpa === "") continue;
      const raizesCategoria = raizes(limpa);
      // Categoria só de palavra genérica ("serviços") não casa com nada.
      if (raizesCategoria.size === 0) continue;
      if (textoObjeto.includes(` ${limpa} `)) return true;
      for (const r of raizesCategoria) if (raizesObjeto.has(r)) return true;
    }
    return false;
  });
}

/** O que o contexto precisa de um atestado gerado no sistema (a linha da tabela atestados cabe aqui). */
export interface AtestadoParaContexto {
  id: string;
  clienteNome: string;
  objeto: string;
  areas: readonly string[];
  valor: number | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  status: string;
}

export interface EntradaContexto {
  item: OportunidadeComScore;
  perfil: PerfilEmpresa;
  /** Preço sugerido calculado pelo sistema; null quando não deu para calcular */
  preco: PrecoSugerido | null;
  cotacoes: ResumoCotacoes | null;
  ficha: FichaEdital | null;
  /** Itens da compra no PNCP, se foram carregados */
  itensCompra: readonly ItemCompra[] | null;
  /** Total de itens no PNCP; `itensCompra` pode vir limitado */
  totalItensCompra: number;
  /** Fornecedores cadastrados da empresa (o filtro por objeto é feito aqui) */
  fornecedores: readonly Fornecedor[];
  excecoesPregao: readonly string[];
  /** Comissão de quem opera, % sobre o bruto (a do item do pipeline; 0 sem marcar) */
  comissaoPercentual?: number;
  /** Terceirização, custo do dev e meses de contrato do item (lerSoftwareDoItem); null/ausente sem resposta */
  software?: DadosSoftware | null;
  /** Documentos do acervo da empresa; null/ausente quando não deu para ler (o bloco some) */
  acervo?: readonly DocumentoAcervo[] | null;
  /** Atestados gerados no sistema; null/ausente quando não deu para ler */
  atestados?: readonly AtestadoParaContexto[] | null;
}

export interface ContextoConselheiro {
  texto: string;
  pregao: RegraPregao;
  fornecedores: Fornecedor[];
  /** Todos os valores em reais que o sistema entregou ao assistente (base da conferência da resposta) */
  valoresPermitidos: number[];
  /** Resultado no alvo positivo (e a conta de software, se houver, não reprova): base para "talvez" virar "vale" */
  resultadoPositivo: boolean;
}

function linhaPreco(p: PrecoSugerido, valores: number[]): string[] {
  const guardar = (v: number | null): string => {
    if (v !== null) valores.push(v);
    return brl(v);
  };
  const linhas = [
    `Veredito do sistema: ${ROTULO_VEREDITO[p.veredito]} (${ROTULO_CONFIANCA[p.confianca].toLowerCase()}).`,
    `Piso (custo mais impostos, margem zero): ${guardar(p.piso)}.`,
    `Alvo (custo com a margem alvo mais impostos): ${guardar(p.alvo)}.`,
    `Teto (valor provável de vitória): ${guardar(p.teto)}.`,
    `Preço sugerido: ${guardar(p.sugerido)}.`,
    `Custo total cotado: ${guardar(p.custoTotal)}; lucro no alvo: ${guardar(p.lucroNoAlvo)}.`,
    `Margem alvo: ${p.margemAlvoPct === null ? "não informada" : `${p.margemAlvoPct}%`}; margem no preço sugerido: ${p.margemSugeridaPct === null ? "não informada" : `${p.margemSugeridaPct}%`}.`,
    `Regime de imposto: ${p.regime === "mei" ? "MEI (DAS fixo)" : "Simples Nacional"}.`,
  ];
  if (p.fontes.length > 0) linhas.push("O que entrou no cálculo:", ...p.fontes.map((f) => `- ${f}`));
  if (p.faltando.length > 0) linhas.push("O que falta para melhorar o cálculo:", ...p.faltando.map((f) => `- ${f}`));
  return linhas;
}

function linhasCotacoes(c: ResumoCotacoes, valores: number[]): string[] {
  const linhas = [`${c.quantidade} ${c.quantidade === 1 ? "cotação" : "cotações"} da empresa ligadas ao item.`];
  for (const g of c.frentes) {
    for (const l of g.listas) {
      valores.push(l.custoTotal.media, l.custoTotal.menor, l.custoTotal.maior);
      linhas.push(
        `- ${g.frente === "produtos" ? "Produto" : "Serviço"}: ${cortar(l.descricao, 200)}; ${l.quantidade} ${l.quantidade === 1 ? "cotação" : "cotações"}; custo total médio ${brl(l.custoTotal.media)} (de ${brl(l.custoTotal.menor)} a ${brl(l.custoTotal.maior)}).`,
      );
    }
  }
  return linhas;
}

function campoFicha<T>(rotulo: string, valor: T | null, formatar: (v: T) => string): string | null {
  if (valor === null) return null;
  const texto = formatar(valor);
  return texto === NAO_INFORMADO ? null : `${rotulo}: ${texto}`;
}

function linhasFicha(f: FichaEdital): string[] {
  const simNao = (v: boolean): string => (v ? "sim" : "não");
  const linhas = [
    `Natureza: ${NOME_NATUREZA[f.natureza.valor]}`,
    campoFicha("Forma de pagamento", f.formaPagamento.valor, (v) => cortar(v, 300)),
    campoFicha("Prazo de pagamento (dias)", f.prazoPagamentoDias.valor, String),
    campoFicha("Pagamento por medição mensal", f.medicaoMensal.valor, simNao),
    campoFicha("Pagamento antecipado", f.pagamentoAntecipado.valor, simNao),
    campoFicha("Prazo de entrega (dias)", f.prazoEntregaDias.valor, String),
    campoFicha("Local de entrega", f.localEntrega.valor, (v) => cortar(v, 200)),
    campoFicha("Garantia contratual (%)", f.garantiaContratualPercentual.valor, String),
    campoFicha("Reajuste", f.reajuste.valor, (v) => cortar(v, 200)),
    campoFicha("Multas e sanções", f.multasSancoes.valor, (v) => cortar(v, 400)),
    campoFicha("Amostra ou prova de conceito", f.amostraProvaConceito.valor, (v) => cortar(v, 200)),
    campoFicha("Visita técnica", f.visitaTecnica.valor, (v) => cortar(v, 200)),
    campoFicha("Critério de julgamento", f.criterioJulgamento.valor, (v) => cortar(v, 200)),
    campoFicha("Modo de disputa", f.modoDisputa.valor, (v) => cortar(v, 200)),
    campoFicha("Exclusivo para ME/EPP", f.exclusividadeMeEpp.valor, simNao),
  ].filter((l): l is string => l !== null);
  if (f.documentosHabilitacao.valor.length > 0) {
    linhas.push(
      `Documentos de habilitação: ${f.documentosHabilitacao.valor.slice(0, MAX_DOCUMENTOS).map((d) => cortar(d, 120)).join("; ")}.`,
    );
  }
  return linhas;
}

function linhaItemCompra(i: ItemCompra, valores: number[]): string {
  if (!i.sigiloso) {
    if (i.valorUnitarioEstimado !== null) valores.push(i.valorUnitarioEstimado);
    if (i.valorTotalEstimado !== null) valores.push(i.valorTotalEstimado);
  }
  const partes = [
    `Item ${i.numero}: ${cortar(i.descricao, 240)}`,
    `quantidade ${i.quantidade ?? "não informada"}${i.unidade ? ` ${i.unidade}` : ""}`,
    i.sigiloso ? "valor estimado sigiloso" : `valor unitário estimado ${brl(i.valorUnitarioEstimado)}`,
  ];
  if (i.exclusivoMeEpp) partes.push("exclusivo para ME/EPP");
  return `- ${partes.join("; ")}`;
}

function linhaFornecedor(f: Fornecedor): string {
  const partes = [f.nome];
  if (f.categorias.trim() !== "") partes.push(`categorias: ${cortar(f.categorias, 160)}`);
  if (f.observacao.trim() !== "") partes.push(`observação: ${cortar(f.observacao, 200)}`);
  if (f.site.trim() !== "") partes.push(`site: ${cortar(f.site, 120)}`);
  return `- ${partes.join("; ")}`;
}

/** Monta o texto do pedido e devolve junto a regra do pregão, os fornecedores que casaram e os valores entregues. */
function comissaoDe(e: EntradaContexto): number {
  return comissaoDoItem(e.comissaoPercentual ?? e.software?.comissaoPercentual);
}

function receitaDe(e: EntradaContexto): number | null {
  return e.preco?.alvo ?? e.preco?.sugerido ?? e.item.valorEstimado;
}

function contaLucroDe(e: EntradaContexto): ContaLucro | null {
  const receita = receitaDe(e);
  return receita === null ? null : contaLucro({ receita, custo: e.preco?.custoTotal ?? null, comissaoPercentual: comissaoDe(e), oportunidade: e.item });
}

/** Conta de site, sistema e software; null quando o objeto não é desenvolvimento ou falta valor. */
function contaSoftwareDe(e: EntradaContexto): ContaSoftware | null {
  if (!ehDesenvolvimento(e.item.objeto)) return null;
  // O lance que a empresa disse vale mais que o preço alvo ou o estimado: é o que ela vai receber.
  const lance = e.software?.precoLance ?? null;
  const bruto = lance !== null && lance > 0 ? lance : receitaDe(e);
  if (bruto === null) return null;
  return contaSoftware({
    bruto,
    horasMes: e.software?.horasMes ?? null,
    meses: e.software?.contratoMeses ?? null,
    comissaoPercentual: comissaoDe(e),
    terceirizavel: e.software?.terceirizavel ?? null,
    devCusto: e.software?.devCusto ?? null,
    valorReferencia: e.item.valorEstimado,
  });
}

function linhasLucro(e: EntradaContexto, valores: number[], conta: ContaLucro | null): string[] {
  const guardar = (v: number): string => {
    valores.push(v);
    return brl(v);
  };
  const linhas: string[] = [];
  if (conta === null) {
    linhas.push("Sem preço alvo nem valor estimado: não há como calcular o resultado.");
  } else {
    linhas.push(
      `Receita considerada (${e.preco?.alvo != null ? "preço alvo" : e.preco?.sugerido != null ? "preço sugerido" : "valor estimado"}): ${guardar(conta.receita)}.`,
      `Custo ${conta.custoEstimado ? "estimado pelo tipo do objeto (sem fornecedor cotado)" : "cotado"}: ${guardar(conta.custo)}.`,
      `Comissão de quem opera (${conta.comissaoPercentual}% do bruto): ${guardar(conta.comissao)}.`,
      `Resultado: ${guardar(conta.resultado)} (${conta.situacao === "prejuizo" ? "PREJUÍZO" : conta.situacao === "empate" ? "empate" : "lucro"}, margem ${conta.margemPercentual}%).`,
      `Preço mínimo sem prejuízo: ${guardar(conta.precoMinimo)}.`,
    );
  }
  const caminho = caminhoDoDinheiro(e.ficha, e.item);
  const caixa = caminho.caixaNecessario;
  linhas.push(
    `Caixa a pôr antes de receber: ${caixa.valor === null ? "não calculado" : guardar(caixa.valor)} (nível ${caixa.nivel}).`,
    `Dias sem receber: ${caminho.diasSemReceber === null ? "não informado no edital" : caminho.diasSemReceber}.`,
  );
  return linhas;
}

function descricaoDoCasamento(p: RegraPregao): string {
  if (p.excecao !== null) return `a exceção "${p.excecao}"`;
  return p.casouFoco === ATIVIDADE_DA_EMPRESA ? "a atividade (CNAE) da empresa" : `o foco "${p.casouFoco ?? ""}"`;
}

const ROTULO_VEREDITO_SOFTWARE: Record<ContaSoftware["veredito"], string> = {
  vale: "VALE",
  "nao-vale": "NÃO VALE",
  pendente: "pendente (falta dado)",
};

/** Bloco da conta de software; os números entram nos valores permitidos para a resposta poder citá-los. */
function linhasSoftware(e: EntradaContexto, conta: ContaSoftware | null, valores: number[]): string[] {
  const guardar = (v: number): string => {
    valores.push(v);
    return brl(v);
  };
  const linhas = [
    `Regras do dono: mínimo de ${guardar(MINIMO_MENSAL_SOFTWARE)} por mês; hora técnica de ${guardar(VALOR_HORA)} (${HORAS_POR_MES} h por mês); depois da comissão e do dev, a sobra tem que ficar em pelo menos ${MARGEM_MINIMA_DONO}% do bruto.`,
  ];
  if (conta === null) {
    linhas.push("Sem preço alvo nem valor estimado: não há como fechar a conta de software.");
    return linhas;
  }
  const terceirizavel = e.software?.terceirizavel ?? null;
  linhas.push(
    `Contrato de ${conta.meses} ${conta.meses === 1 ? "mês" : "meses"} sobre ${guardar(conta.bruto)}: ${guardar(conta.valorMensal)} por mês, o que paga ${guardar(conta.horaPaga)} por hora${conta.abaixoDoMinimo ? " (ABAIXO do mínimo)" : ""}.`,
    `Terceirizável: ${terceirizavel === null ? "ainda não respondido" : terceirizavel ? "sim" : "não (a empresa faz sozinha)"}.`,
    `Teto do dev (bruto menos comissão menos ${MARGEM_MINIMA_DONO}% do dono): ${guardar(conta.tetoDev ?? tetoDoDev(conta.bruto, comissaoDe(e)))}.`,
  );
  if (terceirizavel === true) {
    const parcelas = e.software?.devParcelas ?? null;
    linhas.push(
      conta.devCusto > 0
        ? `Dev combinado: ${guardar(conta.devCusto)}${parcelas !== null ? ` em ${parcelas} ${parcelas === 1 ? "parcela" : "parcelas"}` : ""}.`
        : "Dev ainda sem cotação.",
    );
  }
  if (terceirizavel === false && conta.custoProprio > 0) {
    linhas.push(`Horas próprias: ${e.software?.horasMes ?? 0} h por mês a ${guardar(VALOR_HORA)}, custo de ${guardar(conta.custoProprio)} no contrato.`);
  }
  const lance = e.software?.precoLance ?? null;
  if (lance !== null && lance > 0) linhas.push(`Lance que a empresa vai dar: ${guardar(lance)}.`);
  linhas.push(
    `Comissão: ${guardar(conta.comissao)}; sobra para o dono: ${guardar(conta.sobra)} (${conta.margemPercentual}%).`,
    `Veredito do sistema (conta de software): ${ROTULO_VEREDITO_SOFTWARE[conta.veredito]}. Motivo: ${conta.motivo}.`,
    `Preço mínimo (mínimo mensal ou o que mantém a margem com o dev): ${guardar(conta.precoMinimo)}.`,
  );
  if (conta.folga !== null) {
    linhas.push(
      `Folga até o valor estimado pelo órgão: ${guardar(conta.folga)} (${conta.folgaPercentual}%)${conta.folga < 0 ? ": o preço mínimo passa do valor estimado" : ""}.`,
    );
  }
  return linhas;
}

/** Atestado gerado no sistema no formato do acervo, para usar o mesmo casamento com o objeto. */
function atestadoComoDocumento(a: AtestadoParaContexto): DocumentoAcervo {
  return {
    id: a.id,
    tipo: "atestado",
    titulo: a.objeto,
    emissor: a.clienteNome,
    emissorCnpj: null,
    descricao: "",
    areas: [...a.areas],
    valor: a.valor,
    periodoInicio: a.periodoInicio,
    periodoFim: a.periodoFim,
    emitidoEm: null,
    validade: null,
    arquivoTipo: null,
    arquivoNome: null,
    arquivoTamanho: null,
    atestadoId: a.id,
    criadoEm: "",
  };
}

/** Bloco do acervo: até MAX_LINHAS_ACERVO linhas, os que casam com o objeto primeiro. */
function linhasAcervo(e: EntradaContexto, documentos: readonly DocumentoAcervo[], atestados: readonly AtestadoParaContexto[]): string[] {
  const jaNoAcervo = new Set(documentos.map((d) => d.atestadoId).filter((id): id is string => id !== null));
  const statusPorAtestado = new Map(atestados.map((a) => [a.id, a.status]));
  const todos = [...documentos, ...atestados.filter((a) => !jaNoAcervo.has(a.id)).map(atestadoComoDocumento)];
  if (todos.length === 0) {
    return ["A empresa não tem documento nem atestado cadastrado. Atestado se consegue com cliente anterior ou se gera no gerador de atestados."];
  }
  const casados = new Map(sugerirDoAcervo(e.item.objeto, todos, todos.length).map((s) => [s.documento.id, s.motivo]));
  const ordenados = [...todos].sort((a, b) => Number(casados.has(b.id)) - Number(casados.has(a.id)));
  const linhas = ordenados.slice(0, MAX_LINHAS_ACERVO).map((d) => {
    const motivo = casados.get(d.id);
    const status = d.atestadoId !== null ? statusPorAtestado.get(d.atestadoId) : undefined;
    const partes = [`${ROTULO_CURTO_TIPO_ACERVO[d.tipo]}: ${cortar(d.titulo, 120)}`];
    if (d.emissor.trim() !== "") partes.push(`cliente/emissor: ${cortar(d.emissor, 80)}`);
    if (status !== undefined && status !== "assinado") partes.push(`situação: ${status}`);
    partes.push(motivo !== undefined ? `casa com o objeto (${motivo.replace(/^Bate com: /, "")})` : "não parece casar com o objeto");
    return `- ${partes.join("; ")}`;
  });
  if (todos.length > MAX_LINHAS_ACERVO) linhas.push(`- Mais ${todos.length - MAX_LINHAS_ACERVO} documentos não listados aqui.`);
  linhas.push(
    casados.size > 0
      ? `${casados.size} de ${todos.length} parecem casar com este objeto.`
      : `Nenhum dos ${todos.length} parece casar com este objeto.`,
  );
  return linhas;
}

export function montarContexto(e: EntradaContexto): ContextoConselheiro {
  const { item, perfil } = e;
  const valores: number[] = [];
  if (item.valorEstimado !== null) valores.push(item.valorEstimado);

  const pregao = avaliarPregao({
    modalidadeId: item.modalidadeId,
    modalidadeNome: item.modalidadeNome,
    objeto: item.objeto,
    excecoes: e.excecoesPregao,
    focoCasado: item.score.foco ?? casarFoco(item.objeto, perfil.foco),
    cnaesCasados: item.score.cnaesCasados,
  });
  const contaDoLucro = contaLucroDe(e);
  const contaDoSoftware = contaSoftwareDe(e);
  const fornecedores = fornecedoresDoObjeto(e.fornecedores, item.objeto).slice(0, MAX_FORNECEDORES_NO_CONTEXTO);

  const secoes: string[][] = [];

  secoes.push([
    "ITEM DO PIPELINE",
    `Objeto: ${cortar(item.objeto, MAX_OBJETO)}`,
    `Órgão: ${item.orgao}${item.unidade ? ` (${item.unidade})` : ""}`,
    `Local: ${item.municipio}/${item.uf}; região: ${ROTULO_REGIAO[item.regiao]}`,
    `Modalidade: ${item.modalidadeNome}`,
    `Valor estimado pelo órgão: ${brl(item.valorEstimado)}`,
    `Abertura das propostas: ${item.dataAbertura ?? "não informada"}; encerramento: ${item.dataEncerramento}`,
    `Frente do objeto: ${item.score.frenteCasada === null ? "sem frente casada" : item.score.frenteCasada === "produtos" ? "produtos" : "serviços"}`,
  ]);

  secoes.push([
    "MODALIDADE E FOCO ATUAL",
    `Exceções de pregão da empresa: ${e.excecoesPregao.length > 0 ? e.excecoesPregao.join(", ") : "nenhuma"}.`,
    `Foco da empresa: ${perfil.foco.length > 0 ? perfil.foco.join(", ") : "nenhum termo cadastrado"}.`,
    pregao.ehPregao
      ? pregao.excecao !== null || pregao.casouFoco !== null
        ? `Esta contratação é pregão e o objeto casa com ${descricaoDoCasamento(pregao)}: está dentro do foco (foraDoFoco = false). Decida pelos números, como em qualquer outra modalidade.`
        : "Esta contratação é pregão e o objeto NÃO casa com exceção, foco nem atividade da empresa: está fora do foco atual (foraDoFoco = true). Avise na observação, mas o veredito sai dos números (lucro, caixa, conta de software, acervo); não reprove só por ser pregão."
      : "Esta contratação não é pregão (foraDoFoco = false).",
  ]);

  if (e.ficha !== null) secoes.push(["FICHA DO EDITAL (lida do edital e conferida pelo gestor)", ...linhasFicha(e.ficha)]);

  if (e.itensCompra !== null && e.itensCompra.length > 0) {
    const listados = [...e.itensCompra].sort((a, b) => a.numero - b.numero).slice(0, MAX_ITENS_NO_CONTEXTO);
    const total = Math.max(e.totalItensCompra, e.itensCompra.length);
    const secao = [`ITENS DA COMPRA (${listados.length} de ${total})`, ...listados.map((i) => linhaItemCompra(i, valores))];
    if (total > listados.length) secao.push(`- Mais ${total - listados.length} itens não listados aqui.`);
    secoes.push(secao);
  }

  secoes.push([
    "PREÇO SUGERIDO PELO SISTEMA (únicos números de preço permitidos na resposta)",
    ...(e.preco !== null ? linhaPreco(e.preco, valores) : ["O sistema ainda não calculou o preço sugerido deste item."]),
  ]);

  if (e.cotacoes !== null) secoes.push(["COTAÇÕES DA EMPRESA", ...linhasCotacoes(e.cotacoes, valores)]);

  secoes.push(["LUCRO × PREJUÍZO E CAIXA (calculado pelo sistema; base da decisão)", ...linhasLucro(e, valores, contaDoLucro)]);

  if (ehDesenvolvimento(item.objeto)) {
    secoes.push(["SITE, SISTEMA E SOFTWARE (conta do dono; pesa junto com o lucro)", ...linhasSoftware(e, contaDoSoftware, valores)]);
  }

  if (e.acervo != null || e.atestados != null) {
    secoes.push(["ACERVO DA EMPRESA (documentos e atestados que ela já tem)", ...linhasAcervo(e, e.acervo ?? [], e.atestados ?? [])]);
  }

  secoes.push([
    "FORNECEDORES CADASTRADOS QUE CASAM COM O OBJETO",
    ...(fornecedores.length > 0
      ? fornecedores.map(linhaFornecedor)
      : ["Nenhum fornecedor ativo cadastrado casa com este objeto."]),
  ]);

  secoes.push([
    "PERFIL DA EMPRESA",
    textoPerfil(perfil),
    `Regiões em que atende: ${perfil.regioes.length > 0 ? perfil.regioes.map((r) => ROTULO_REGIAO[r]).join(", ") : "não informadas"}.`,
  ]);

  return {
    texto: secoes.map((s) => s.join("\n")).join("\n\n"),
    pregao,
    fornecedores,
    valoresPermitidos: valores,
    resultadoPositivo: contaDoLucro?.situacao === "lucro" && (contaDoSoftware === null || contaDoSoftware.veredito !== "nao-vale"),
  };
}
