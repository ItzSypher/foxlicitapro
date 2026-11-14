import { PERFIL_ORIGEM } from "@/core/empresa";
import { atendeRegiao, ehMei, type PerfilEmpresa } from "@/core/perfil";
import { limiteMeiAnual, TETO_MEI_ANO_CHEIO } from "@/core/score";
import { regiaoDe } from "@/core/regioes";
import type { Frente, ModalidadeId, Oportunidade } from "@/core/types";
import type { ArquivoCompra, DetalheCompra, ItemCompra } from "@/core/types-detalhe";
import { MS_HORA, formatarMoeda, plural } from "@/lib/formato";

const FUSO = "America/Sao_Paulo";

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const fmtQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const fmtUnitario = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** "16/11/2026 08:00" no horário de Brasília; null vira null. */
export function dataHora(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : fmtDataHora.format(d).replace(", ", " ");
}

export function soData(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : fmtData.format(d);
}

export function quantidadeBr(valor: number): string {
  return fmtQuantidade.format(valor);
}

/** Valor unitário com até 4 casas, para não esconder centavos de fração. */
export function unitarioBr(valor: number): string {
  return fmtUnitario.format(valor);
}

export function somaItens(itens: readonly ItemCompra[]): number | null {
  let soma = 0;
  let achou = false;
  for (const item of itens) {
    if (item.valorTotalEstimado !== null) {
      soma += item.valorTotalEstimado;
      achou = true;
    }
  }
  return achou ? Math.round(soma * 100) / 100 : null;
}

function ehModalidadeValida(id: number): id is ModalidadeId {
  return id === 6 || id === 8;
}

/**
 * Monta a Oportunidade do Radar a partir do detalhe, para recalcular a nota e salvar no pipeline.
 * Devolve null quando faltam dados que o contrato exige (modalidade 6/8 e prazo de encerramento).
 */
export function montarOportunidade(d: DetalheCompra): Oportunidade | null {
  if (!ehModalidadeValida(d.modalidadeId) || d.dataEncerramento === null) return null;
  return {
    id: d.numeroControle,
    objeto: d.objeto,
    valorEstimado: d.valorEstimado,
    orgao: d.orgao,
    orgaoCnpj: d.orgaoCnpj,
    unidade: d.unidade,
    municipio: d.municipio,
    codigoIbge: d.codigoIbge,
    uf: d.uf,
    regiao: regiaoDe(d.codigoIbge, d.uf),
    modalidadeId: d.modalidadeId,
    modalidadeNome: d.modalidadeNome,
    dataAbertura: d.dataAbertura,
    dataEncerramento: d.dataEncerramento,
    anoCompra: d.chave.ano,
    sequencialCompra: d.chave.sequencial,
    linkPncp: d.linkPncp,
    linkOrigem: d.linkOrigem ?? d.linkProcesso,
  };
}

export type TomSinal = "positive" | "warning" | "negative";

export interface Sinal {
  id: string;
  tom: TomSinal;
  texto: string;
}

const TIPOS_PRINCIPAIS = /edital|termo de refer|aviso/i;

export function ehArquivoPrincipal(a: ArquivoCompra): boolean {
  return TIPOS_PRINCIPAIS.test(a.tipo ?? "") || TIPOS_PRINCIPAIS.test(a.titulo);
}

function anoDe(iso: string | null, padrao: number): number {
  const ano = iso === null ? Number.NaN : Number(iso.slice(0, 4));
  return Number.isInteger(ano) ? ano : padrao;
}

function sinalItens(d: DetalheCompra): Sinal | null {
  if (d.falhas.includes("itens") || d.itens.length === 0) return null;
  const exclusivos = d.itens.filter((i) => i.exclusivoMeEpp).length;
  const recorte = d.itens.length < d.totalItens ? ` (nos ${d.itens.length} primeiros)` : "";
  if (exclusivos === 0) {
    return { id: "me-epp", tom: "warning", texto: `Nenhum item é exclusivo para ME/EPP${recorte}.` };
  }
  const todos = exclusivos === d.itens.length;
  return {
    id: "me-epp",
    tom: "positive",
    texto: todos
      ? `Todos os ${d.itens.length} itens são exclusivos para ME/EPP${recorte}.`
      : `${exclusivos} de ${d.itens.length} ${plural(d.itens.length, "item", "itens")} exclusivos para ME/EPP${recorte}.`,
  };
}

function sinalValor(d: DetalheCompra, perfil: PerfilEmpresa): Sinal {
  if (d.valorEstimado === null) {
    return { id: "valor", tom: "warning", texto: "Valor sigiloso ou não informado: confirme no edital." };
  }
  const ano = anoDe(d.dataEncerramento, d.chave.ano);
  const valor = formatarMoeda(d.valorEstimado);
  if (!ehMei(perfil)) return { id: "valor", tom: "positive", texto: `Valor estimado de ${valor}.` };
  const limite = limiteMeiAnual(ano, perfil);
  if (d.valorEstimado <= limite) {
    return { id: "valor", tom: "positive", texto: `${valor} cabe no limite MEI de ${ano} (${formatarMoeda(limite)}).` };
  }
  if (d.valorEstimado > TETO_MEI_ANO_CHEIO) {
    return {
      id: "valor",
      tom: "negative",
      texto: `${valor} passa do teto anual do MEI (${formatarMoeda(TETO_MEI_ANO_CHEIO)}): só disputando parte dos itens.`,
    };
  }
  if (d.valorEstimado <= 2 * limite) {
    return { id: "valor", tom: "warning", texto: `${valor} passa do limite MEI de ${ano} (${formatarMoeda(limite)}), mas cabe em até 2 vezes.` };
  }
  return { id: "valor", tom: "negative", texto: `${valor} passa de 2 vezes o limite MEI de ${ano} (${formatarMoeda(limite)}).` };
}

function sinalLocal(d: DetalheCompra, frente: Frente, perfil: PerfilEmpresa): Sinal {
  const regiao = regiaoDe(d.codigoIbge, d.uf);
  const onde = `${d.municipio}${d.uf ? `/${d.uf}` : ""}`;
  const atende = atendeRegiao(perfil, regiao);
  if (!atende && regiao !== "fora-rj") {
    return {
      id: "local",
      tom: frente === "servicos" ? "negative" : "warning",
      texto: `${onde}, fora das suas regiões de interesse.`,
    };
  }
  if (regiao === "nova-iguacu") return { id: "local", tom: "positive", texto: `Em ${onde}: sem deslocamento.` };
  if (regiao === "baixada") return { id: "local", tom: "positive", texto: `${onde}, na Baixada Fluminense: deslocamento curto.` };
  if (regiao === "capital") return { id: "local", tom: "warning", texto: `${onde}, na capital: deslocamento médio.` };
  if (regiao === "rj") return { id: "local", tom: "warning", texto: `${onde}, no interior do estado: deslocamento longo.` };
  return {
    id: "local",
    tom: frente === "servicos" ? "negative" : "warning",
    texto:
      frente === "servicos"
        ? `${onde}, fora do estado do Rio: inviável para serviço presencial.`
        : `${onde}, fora do estado do Rio: o frete pesa.`,
  };
}

function sinalPrazo(d: DetalheCompra, agora: number): Sinal | null {
  if (d.dataEncerramento === null) return null;
  const restante = Date.parse(d.dataEncerramento) - agora;
  if (Number.isNaN(restante)) return null;
  if (restante <= 0) return { id: "prazo", tom: "negative", texto: "O prazo para propostas já encerrou." };
  if (restante < 48 * MS_HORA) return { id: "prazo", tom: "warning", texto: "Prazo curto: encerra em menos de 48 horas." };
  return null;
}

function sinalArquivos(d: DetalheCompra): Sinal | null {
  if (d.falhas.includes("arquivos")) return null;
  const n = d.arquivos.length;
  if (n === 0) return { id: "arquivos", tom: "warning", texto: "O órgão não publicou arquivos." };
  const principal = d.arquivos.some(ehArquivoPrincipal);
  return {
    id: "arquivos",
    tom: "positive",
    texto: `${n} ${plural(n, "arquivo para ler", "arquivos para ler")}${principal ? ", incluindo o edital ou termo de referência" : ""}.`,
  };
}

/** Frases curtas, geradas por regra, sobre o que importa para o perfil do MEI. */
export function gerarSinais(d: DetalheCompra, frente: Frente, agora: number, perfil: PerfilEmpresa = PERFIL_ORIGEM): Sinal[] {
  const sinais: Array<Sinal | null> = [
    sinalItens(d),
    sinalValor(d, perfil),
    sinalLocal(d, frente, perfil),
    sinalPrazo(d, agora),
    d.srp
      ? { id: "srp", tom: "warning", texto: "Registro de preços: a compra sai por demanda, sem volume garantido." }
      : null,
    sinalArquivos(d),
  ];
  return sinais.filter((s): s is Sinal => s !== null);
}

/** "Dispensa nº 90012/2026 · Processo 123 · Órgão", pulando o que faltar. */
export function linhaIdentificacao(d: DetalheCompra): string {
  const partes = [
    d.numeroCompra ? `${d.modalidadeNome} nº ${d.numeroCompra}/${d.chave.ano}` : d.modalidadeNome,
    d.processo ? `Processo ${d.processo}` : null,
    d.orgao || null,
  ];
  return partes.filter((p): p is string => p !== null).join(" · ");
}

/** Texto de uma linha do item: "10 un × R$ 45,00 = R$ 450,00"; partes ausentes viram traço. */
export function contaDoItem(item: ItemCompra): string {
  if (item.sigiloso) {
    const q = item.quantidade === null ? "—" : quantidadeBr(item.quantidade);
    return `${q}${item.unidade ? ` ${item.unidade}` : ""} · orçamento sigiloso`;
  }
  const q = item.quantidade === null ? "—" : `${quantidadeBr(item.quantidade)}${item.unidade ? ` ${item.unidade}` : ""}`;
  const u = item.valorUnitarioEstimado === null ? "—" : unitarioBr(item.valorUnitarioEstimado);
  const t = item.valorTotalEstimado === null ? "—" : formatarMoeda(item.valorTotalEstimado);
  return `${q} × ${u} = ${t}`;
}
