import { ROTULO_STATUS } from "./revisao";
import type { StatusPropostaEquipe } from "./types-equipe";

/**
 * Comando "propostas" no WhatsApp: lista numerada das propostas que pedem ação e, depois, o detalhe da escolhida.
 * Funções puras; a leitura do banco e o envio ficam em lib/whatsapp-propostas.ts.
 */

export const MAX_PROPOSTAS_LISTA = 8;
/** A lista vale por 6 h: depois disso, "3" volta a ser texto comum e a pessoa pede a lista de novo. */
export const VALIDADE_LISTA_MS = 6 * 3_600_000;

export interface PropostaDaLista {
  id: string;
  objeto: string;
  total: number;
  status: StatusPropostaEquipe;
  /** ISO 8601 */
  atualizadoEm: string;
  criadoPorNome: string | null;
  externa: boolean;
}

/** O que pede ação primeiro: revisão, depois devolvidas, aprovadas a enviar e rascunhos. Enviadas ficam de fora. */
const ORDEM: Readonly<Partial<Record<StatusPropostaEquipe, number>>> = {
  em_revisao: 0,
  devolvida: 1,
  aprovada: 2,
  pronta: 2,
  rascunho: 3,
};

export function escolherPropostasDaLista(lista: ReadonlyArray<PropostaDaLista>, max: number = MAX_PROPOSTAS_LISTA): PropostaDaLista[] {
  return lista
    .filter((p) => !p.externa && ORDEM[p.status] !== undefined)
    .sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9) || Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm))
    .slice(0, max);
}

function reais(valor: number): string {
  return valor
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: valor % 1 === 0 ? 0 : 2 })
    .replace(/ /g, " ");
}

function cortar(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1).trimEnd()}…`;
}

function primeiroNome(nome: string | null): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function textoListaPropostas(itens: ReadonlyArray<PropostaDaLista>): string {
  if (itens.length === 0) return "Nenhuma proposta pedindo ação agora. As enviadas ficam na tela Propostas.";
  const linhas = itens.map((p, i) => {
    const quem = primeiroNome(p.criadoPorNome);
    const detalhe = [ROTULO_STATUS[p.status], quem, diaCurto(p.atualizadoEm)].filter((x) => x !== "").join(" · ");
    const valor = p.total > 0 ? ` · ${reais(p.total)}` : "";
    return `${i + 1}. *${cortar(p.objeto, 70)}*${valor}\n${detalhe}`;
  });
  return [`📋 Propostas pedindo ação: ${itens.length}`, "", linhas.join("\n\n"), "", "Responda o *número* para abrir e ler."].join("\n");
}

export interface DetalheProposta {
  objeto: string;
  orgao: string;
  total: number;
  itens: number;
  status: StatusPropostaEquipe;
  criadoPorNome: string | null;
  link: string;
  leitura: string | null;
  podeAprovar: boolean;
}

export function textoDetalheProposta(d: DetalheProposta): string {
  const quem = primeiroNome(d.criadoPorNome);
  const linhas = [
    `📄 *${cortar(d.objeto, 120)}*`,
    ...(d.orgao.trim() !== "" ? [cortar(d.orgao, 80)] : []),
    `${reais(d.total)} · ${d.itens} ${d.itens === 1 ? "item" : "itens"} · ${ROTULO_STATUS[d.status]}${quem !== "" ? ` · por ${quem}` : ""}`,
    "",
    ...(d.leitura ? [`Ler o documento (abre sem login): ${d.leitura}`] : []),
    `Abrir no sistema: ${d.link}`,
  ];
  if (d.podeAprovar) linhas.push("", "Leu e está certa? Toque em *Aprovar* para confirmar.");
  return linhas.join("\n");
}

/** Número de 1 a 99 respondido sozinho ("3", "nº 3", "#3"). null quando não é só um número. */
export function lerNumeroEscolhido(texto: string): number | null {
  const m = /^(?:n[º°o.]?\s*|#)?(\d{1,2})$/i.exec(texto.trim());
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

/** Lista guardada para a pessoa: ids na ordem mostrada e quando foi mostrada. */
export interface ListaGuardada {
  ids: string[];
  em: string;
}

export function lerListaGuardada(valor: string | null, agora: Date): ListaGuardada | null {
  if (valor === null) return null;
  try {
    const bruto: unknown = JSON.parse(valor);
    if (typeof bruto !== "object" || bruto === null) return null;
    const { ids, em } = bruto as { ids?: unknown; em?: unknown };
    if (!Array.isArray(ids) || !ids.every((x): x is string => typeof x === "string") || typeof em !== "string") return null;
    const idade = agora.getTime() - Date.parse(em);
    if (Number.isNaN(idade) || idade < 0 || idade > VALIDADE_LISTA_MS) return null;
    return { ids, em };
  } catch {
    return null;
  }
}

export function chaveListaPropostas(usuarioId: string): string {
  return `propsel:${usuarioId}`;
}
