import { z } from "zod";
import type { ChaveCompra, DadosProposta, DetalheCompra, ItemProposta } from "./types-detalhe";
import { obterModelo, type ModeloId } from "./proposta-modelos";

const ItemPropostaSchema = z.object({
  numero: z.number().int(),
  descricao: z.string(),
  unidade: z.string(),
  quantidade: z.number(),
  marcaModelo: z.string(),
  valorUnitario: z.number(),
});

/** Contrato da coluna propostas.dados (jsonb). */
export const DadosPropostaSchema: z.ZodType<DadosProposta> = z.object({
  orgao: z.string(),
  unidade: z.string(),
  objeto: z.string(),
  numeroCompra: z.string(),
  processo: z.string(),
  itens: z.array(ItemPropostaSchema),
  validadeDias: z.number(),
  prazoEntrega: z.string(),
  localEntrega: z.string(),
  pagamento: z.string(),
  garantia: z.string(),
  observacoes: z.string(),
  data: z.string(),
});

const FUSO = "America/Sao_Paulo";

/** Data de hoje em Brasília, yyyy-mm-dd. */
export function dataIsoBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Lê "{cnpj}-{ano}-{sequencial}"; null se o formato não bate. */
export function lerChaveCompra(texto: string): ChaveCompra | null {
  const m = /^(\d{14})-(\d{4})-(\d{1,9})$/.exec(texto.trim());
  if (!m) return null;
  return { cnpj: m[1], ano: Number(m[2]), sequencial: Number(m[3]) };
}

/** "{cnpj}-{ano}-{sequencial}" para a URL de /propostas/nova. */
export function textoChaveCompra(chave: ChaveCompra): string {
  return `${chave.cnpj}-${chave.ano}-${chave.sequencial}`;
}

/** numeroControlePNCP ("00000000000000-1-000123/2026") para a chave da compra. */
export function chaveDeNumeroControle(numeroControle: string): ChaveCompra | null {
  const m = /^(\d{14})-\d+-(\d+)\/(\d{4})$/.exec(numeroControle.trim());
  if (!m) return null;
  return { cnpj: m[1], ano: Number(m[3]), sequencial: Number(m[2]) };
}

/** numeroControlePNCP reconstruído a partir da chave, quando o detalhe não pôde ser lido. */
export function numeroControleDe(chave: ChaveCompra): string {
  return `${chave.cnpj}-1-${String(chave.sequencial).padStart(6, "0")}/${chave.ano}`;
}

export function dadosEmBranco(modeloId: ModeloId, hoje: Date): DadosProposta {
  const padroes = obterModelo(modeloId).padroes;
  return {
    orgao: "",
    unidade: "",
    objeto: "",
    numeroCompra: "",
    processo: "",
    itens: [{ numero: 1, descricao: "", unidade: "UN", quantidade: 1, marcaModelo: "", valorUnitario: 0 }],
    validadeDias: padroes.validadeDias ?? 30,
    prazoEntrega: padroes.prazoEntrega ?? "",
    localEntrega: padroes.localEntrega ?? "",
    pagamento: padroes.pagamento ?? "",
    garantia: padroes.garantia ?? "",
    observacoes: padroes.observacoes ?? "",
    data: dataIsoBrasilia(hoje),
  };
}

/**
 * Dados da proposta a partir do detalhe da compra. O valor unitário parte de zero:
 * o preço é decisão de quem propõe. A estimativa do órgão sai em `referenciasDoDetalhe`.
 */
export function montarDadosIniciais(detalhe: DetalheCompra, modeloId: ModeloId, hoje: Date): DadosProposta {
  const base = dadosEmBranco(modeloId, hoje);
  const itens: ItemProposta[] = [...detalhe.itens]
    .sort((a, b) => a.numero - b.numero)
    .map((i) => ({
      numero: i.numero,
      descricao: i.descricao,
      unidade: i.unidade && i.unidade.trim() !== "" ? i.unidade : "UN",
      quantidade: i.quantidade !== null && i.quantidade > 0 ? i.quantidade : 1,
      marcaModelo: "",
      valorUnitario: 0,
    }));
  return {
    ...base,
    orgao: detalhe.orgao,
    unidade: detalhe.unidade,
    objeto: detalhe.objeto,
    numeroCompra: detalhe.numeroCompra ?? "",
    processo: detalhe.processo ?? "",
    itens: itens.length > 0 ? itens : base.itens,
  };
}

/** Valor unitário estimado pelo órgão, por número do item. Itens sigilosos ou sem estimativa ficam de fora. */
export function referenciasDoDetalhe(detalhe: DetalheCompra): Record<number, number> {
  const refs: Record<number, number> = {};
  for (const i of detalhe.itens) {
    if (!i.sigiloso && i.valorUnitarioEstimado !== null && i.valorUnitarioEstimado > 0) {
      refs[i.numero] = i.valorUnitarioEstimado;
    }
  }
  return refs;
}

export function tituloPadrao(dados: DadosProposta): string {
  const orgao = dados.orgao.trim();
  const compra = dados.numeroCompra.trim();
  if (orgao === "" && compra === "") return "Proposta sem título";
  const base = orgao === "" ? "Proposta" : `Proposta · ${orgao}`;
  const completo = compra === "" ? base : `${base} · ${compra}`;
  return completo.length > 120 ? `${completo.slice(0, 117)}...` : completo;
}

/** Total de um item em centavos inteiros. */
export function totalItemCentavos(item: ItemProposta): number {
  const unitario = Math.round(item.valorUnitario * 100);
  return Math.round(unitario * item.quantidade);
}

/** Total da proposta em centavos inteiros. */
export function totalProposta(dados: DadosProposta): number {
  return dados.itens.reduce((soma, item) => soma + totalItemCentavos(item), 0);
}

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (r > 0) {
    if (r < 20) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: ReadonlyArray<{ valor: number; singular: string; plural: string }> = [
  { valor: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
  { valor: 1_000_000, singular: "milhão", plural: "milhões" },
  { valor: 1_000, singular: "mil", plural: "mil" },
];

/** Inteiro de 0 a 999.999.999.999 por extenso. */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  let resto = n;
  const partes: Array<{ texto: string; grupo: number }> = [];
  for (const escala of ESCALAS) {
    const q = Math.floor(resto / escala.valor);
    if (q > 0) {
      const texto = escala.valor === 1_000 && q === 1 ? "mil" : `${ate999(q)} ${q === 1 ? escala.singular : escala.plural}`;
      partes.push({ texto, grupo: q });
      resto -= q * escala.valor;
    }
  }
  if (resto > 0) partes.push({ texto: ate999(resto), grupo: resto });
  if (partes.length === 1) return partes[0].texto;
  const ultima = partes[partes.length - 1];
  const ligacao = ultima.grupo < 100 || ultima.grupo % 100 === 0 ? " e " : " ";
  return partes.slice(0, -1).map((p) => p.texto).join(" ") + ligacao + ultima.texto;
}

/** Valor em reais por extenso: "mil duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function valorPorExtenso(valor: number): string {
  const centavosTotal = Math.max(0, Math.round(valor * 100));
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;

  const partesTexto: string[] = [];
  if (reais > 0 || centavos === 0) {
    const redondoEmMilhao = reais >= 1_000_000 && reais % 1_000_000 === 0;
    const palavra = reais === 1 ? "real" : redondoEmMilhao ? "de reais" : "reais";
    partesTexto.push(`${inteiroPorExtenso(reais)} ${palavra}`);
  }
  if (centavos > 0) {
    partesTexto.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return partesTexto.join(" e ");
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "12 de novembro de 2026" a partir de yyyy-mm-dd; devolve o texto original se o formato não bate. */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return iso;
  return `${Number(m[3])} de ${MESES[mes - 1]} de ${m[1]}`;
}

/** Modelos de produto que exigem marca e modelo por item (a cotação simples não). */
export function exigeMarcaModelo(modeloId: ModeloId): boolean {
  return modeloId === "dispensa-produtos" || modeloId === "pregao-produtos";
}

/** Pendências em frases, na ordem em que aparecem no documento. Lista vazia: pronta para enviar. */
export function validarProposta(dados: DadosProposta, modeloId?: ModeloId): string[] {
  const pend: string[] = [];
  if (dados.orgao.trim() === "") pend.push("Informe o órgão destinatário.");
  if (dados.objeto.trim() === "") pend.push("Informe o objeto da compra.");
  if (dados.itens.length === 0) pend.push("Inclua ao menos um item.");

  for (const item of dados.itens) {
    if (item.descricao.trim() === "") pend.push(`Item ${item.numero} sem descrição`);
    if (!(item.quantidade > 0)) pend.push(`Item ${item.numero} sem quantidade`);
    if (!(item.valorUnitario > 0)) pend.push(`Item ${item.numero} sem valor unitário`);
    if (modeloId !== undefined && exigeMarcaModelo(modeloId) && item.marcaModelo.trim() === "") {
      pend.push(`Informe marca e modelo do item ${item.numero}`);
    }
  }

  if (!(dados.validadeDias > 0)) pend.push("Informe a validade da proposta.");
  else if (modeloId === "pregao-produtos" && dados.validadeDias < 60) pend.push("Validade abaixo de 60 dias");
  if (dados.prazoEntrega.trim() === "") pend.push("Informe o prazo de entrega ou execução.");
  return pend;
}
