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
import { contaLucro, normalizarComissao } from "@/core/lucro";
import { avaliarPregao, type RegraPregao } from "./pregao";

/** Texto do contexto enviado ao assistente: dados já calculados pelo sistema, sem rede e sem banco. */

/** Itens da compra que vão no pedido; os demais só entram na contagem. */
export const MAX_ITENS_NO_CONTEXTO = 15;
/** Fornecedores que vão no pedido. */
export const MAX_FORNECEDORES_NO_CONTEXTO = 8;
const MAX_OBJETO = 1500;
const MAX_DOCUMENTOS = 12;

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
  /** Comissão de quem opera, % sobre o bruto (padrão da empresa) */
  comissaoPercentual?: number;
}

export interface ContextoConselheiro {
  texto: string;
  pregao: RegraPregao;
  fornecedores: Fornecedor[];
  /** Todos os valores em reais que o sistema entregou ao assistente (base da conferência da resposta) */
  valoresPermitidos: number[];
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
function linhasLucro(e: EntradaContexto, valores: number[]): string[] {
  const guardar = (v: number): string => {
    valores.push(v);
    return brl(v);
  };
  const comissao = normalizarComissao(e.comissaoPercentual);
  const receita = e.preco?.alvo ?? e.preco?.sugerido ?? e.item.valorEstimado;
  const conta = receita === null ? null : contaLucro({ receita, custo: e.preco?.custoTotal ?? null, comissaoPercentual: comissao, oportunidade: e.item });
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

export function montarContexto(e: EntradaContexto): ContextoConselheiro {
  const { item, perfil } = e;
  const valores: number[] = [];
  if (item.valorEstimado !== null) valores.push(item.valorEstimado);

  const pregao = avaliarPregao({
    modalidadeId: item.modalidadeId,
    modalidadeNome: item.modalidadeNome,
    objeto: item.objeto,
    excecoes: e.excecoesPregao,
  });
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
    pregao.ehPregao
      ? pregao.excecao !== null
        ? `Esta contratação é pregão e o objeto casa com a exceção "${pregao.excecao}": vale a pena e deve ser recomendada normalmente (foraDoFoco = false).`
        : "Esta contratação é pregão e o objeto NÃO casa com nenhuma exceção: está fora do foco atual da empresa (foraDoFoco = true)."
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

  secoes.push(["LUCRO × PREJUÍZO E CAIXA (calculado pelo sistema; base da decisão)", ...linhasLucro(e, valores)]);

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
  };
}
