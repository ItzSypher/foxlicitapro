import "server-only";
import { montarOportunidade } from "@/components/licitacao/dominio";
import { ROTULO_ETAPA, type EtapaId } from "@/components/pipeline/tipos";
import { ErroPncp } from "@/core/pncp/client";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { caminhoInterno, lerLinkPncp, lerLinksPncp } from "@/core/link-pncp";
import { resumirObjeto } from "@/core/objeto";
import { calcularScore } from "@/core/score";
import type { Frente, OportunidadeComScore } from "@/core/types";
import type { ChaveCompra } from "@/core/types-detalhe";
import { lerEtapaItem, salvarItem } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { FRENTE_PADRAO } from "@/lib/frente";

/** Quantos links de uma vez; o resto é ignorado para não prender a tela nem o WhatsApp. */
export const MAX_LINKS = 10;
const MAX_TITULO = 100;

export type ResultadoLink =
  | {
      ok: true;
      /** true quando a licitação já estava no Pipeline (nada foi alterado) */
      jaEstava: boolean;
      titulo: string;
      etapa: EtapaId;
      rotuloEtapa: string;
      /** Página interna da licitação, relativa ao site */
      href: string;
    }
  | { ok: false; erro: string };

export type ResultadoDoTexto = { entrada: string } & ResultadoLink;

function tituloCurto(objeto: string): string {
  const texto = resumirObjeto(objeto).trim();
  const base = texto === "" ? "Licitação sem descrição" : texto;
  return base.length <= MAX_TITULO ? base : `${base.slice(0, MAX_TITULO - 1).trimEnd()}…`;
}

function rotuloDaChave(c: ChaveCompra): string {
  return `${c.cnpj}/${c.ano}/${c.sequencial}`;
}

/** Busca a contratação no PNCP e a põe no Pipeline da empresa (etapa Radar). Nunca lança. */
export async function adicionarChave(
  empresaId: string,
  usuarioId: string,
  chave: ChaveCompra,
  frente: Frente = FRENTE_PADRAO,
): Promise<ResultadoLink> {
  try {
    const detalhe = await buscarDetalheCompra(chave);
    if (detalhe === null) return { ok: false, erro: "Não achei essa contratação no PNCP." };
    const titulo = tituloCurto(detalhe.objeto);
    const href = caminhoInterno(chave);

    const atual = await lerEtapaItem(empresaId, detalhe.numeroControle);
    if (atual !== null) return { ok: true, jaEstava: true, titulo, etapa: atual, rotuloEtapa: ROTULO_ETAPA[atual], href };

    const base = montarOportunidade(detalhe);
    if (base === null) {
      return {
        ok: false,
        erro:
          detalhe.dataEncerramento === null
            ? "O PNCP não informa o prazo de propostas dessa contratação."
            : `Esse tipo de contratação (${detalhe.modalidadeNome}) ainda não entra no Pipeline.`,
      };
    }
    const [perfil, preferencias] = await Promise.all([perfilDaEmpresa(empresaId), lerPreferencias(empresaId)]);
    const limites = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
    const score = calcularScore(base, frente, new Date(), { limites }, perfil);
    const oportunidade: OportunidadeComScore = { ...base, score };
    await salvarItem(empresaId, oportunidade, usuarioId);
    return { ok: true, jaEstava: false, titulo, etapa: "radar", rotuloEtapa: ROTULO_ETAPA.radar, href };
  } catch (e) {
    console.error("[pipeline] adicionar pelo link:", e instanceof Error ? e.message : e);
    if (e instanceof ErroPncp) return { ok: false, erro: "O PNCP não respondeu agora. Tente de novo em instantes." };
    return { ok: false, erro: "Não foi possível adicionar ao Pipeline. Tente de novo." };
  }
}

/** Lê o primeiro link do texto e o adiciona ao Pipeline. Quem chama confere a permissão "mover_pipeline". */
export async function adicionarPeloLink(empresaId: string, usuarioId: string, texto: string, frente?: Frente): Promise<ResultadoLink> {
  const chave = lerLinkPncp(texto);
  if (chave === null) return { ok: false, erro: "Link não reconhecido. Use o link da página da licitação no PNCP." };
  return adicionarChave(empresaId, usuarioId, chave, frente);
}

/**
 * Cada linha é um link. Linha sem link reconhecido vira erro; vários links na mesma linha valem todos.
 * Repetidos contam uma vez. Passou de MAX_LINKS, o excedente é avisado e não processado.
 */
export async function adicionarPelosLinks(
  empresaId: string,
  usuarioId: string,
  texto: string,
  frente?: Frente,
): Promise<ResultadoDoTexto[]> {
  const entradas: Array<{ entrada: string; chave: ChaveCompra | null }> = [];
  const vistos = new Set<string>();
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (limpa === "") continue;
    const chaves = lerLinksPncp(limpa);
    if (chaves.length === 0) {
      entradas.push({ entrada: limpa.length > 80 ? `${limpa.slice(0, 79)}…` : limpa, chave: null });
      continue;
    }
    for (const chave of chaves) {
      const id = rotuloDaChave(chave);
      if (vistos.has(id)) continue;
      vistos.add(id);
      entradas.push({ entrada: id, chave });
    }
  }

  const resultados: ResultadoDoTexto[] = [];
  let processados = 0;
  for (const { entrada, chave } of entradas) {
    if (chave === null) {
      resultados.push({ entrada, ok: false, erro: "Link não reconhecido. Use o link da página da licitação no PNCP." });
      continue;
    }
    if (processados >= MAX_LINKS) {
      resultados.push({ entrada, ok: false, erro: `Passou do limite de ${MAX_LINKS} links por vez. Envie este de novo.` });
      continue;
    }
    processados += 1;
    resultados.push({ entrada, ...(await adicionarChave(empresaId, usuarioId, chave, frente)) });
  }
  return resultados;
}
