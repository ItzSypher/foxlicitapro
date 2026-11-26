/**
 * Exigências da ficha do edital em linhas curtas: rótulo, valor e um sinal de conferência.
 * Funções puras, sem rede nem banco.
 */
import { NAO_INFORMADO, type FichaEdital } from "@/core/ficha";

export interface LinhaExigencia {
  id: string;
  rotulo: string;
  /** Valor curto, pronto para mostrar */
  valor: string;
  /** true quando vale conferir no edital (falta informação ou há exigência a cumprir) */
  atencao: boolean;
  trecho: string | null;
  pagina: number | null;
  /** Lista de apoio (documentos de habilitação), recolhida na tela */
  itens?: string[];
}

function ausente(texto: string): boolean {
  const limpo = texto.trim().toLowerCase();
  return limpo === "" || limpo.startsWith(NAO_INFORMADO);
}

function textoCurto(rotulo: string, id: string, valor: string, trecho: string | null, pagina: number | null): LinhaExigencia {
  const falta = ausente(valor);
  return { id, rotulo, valor: falta ? "Não informado" : valor, atencao: falta, trecho, pagina };
}

/** As exigências da ficha: ✓ quando está claro e sem peso, ⚠ quando falta dado ou há algo a cumprir. */
export function linhasDeExigencias(ficha: FichaEdital): LinhaExigencia[] {
  const garantia = ficha.garantiaContratualPercentual;
  const meEpp = ficha.exclusividadeMeEpp;
  const docs = ficha.documentosHabilitacao;
  const multas = ficha.multasSancoes;

  const linhas: LinhaExigencia[] = [
    textoCurto("Critério de julgamento", "criterio", ficha.criterioJulgamento.valor, ficha.criterioJulgamento.trecho, ficha.criterioJulgamento.pagina),
    textoCurto("Modo de disputa", "modo", ficha.modoDisputa.valor, ficha.modoDisputa.trecho, ficha.modoDisputa.pagina),
    {
      id: "me-epp",
      rotulo: "Exclusivo ME/EPP",
      valor: meEpp.valor === null ? "Não informado" : meEpp.valor ? "Sim" : "Não",
      atencao: meEpp.valor === null,
      trecho: meEpp.trecho,
      pagina: meEpp.pagina,
    },
    {
      id: "garantia",
      rotulo: "Garantia contratual",
      valor:
        garantia.valor === null
          ? "Não informado"
          : garantia.valor === 0
            ? "Sem garantia"
            : `${garantia.valor.toLocaleString("pt-BR")}% do contrato`,
      atencao: garantia.valor === null || garantia.valor > 0,
      trecho: garantia.trecho,
      pagina: garantia.pagina,
    },
    {
      id: "multas",
      rotulo: "Multas e sanções",
      valor: ausente(multas.valor) ? "Não informado" : multas.valor,
      // Multa prevista é regra a cumprir; sempre vale conferir.
      atencao: true,
      trecho: multas.trecho,
      pagina: multas.pagina,
    },
    {
      id: "documentos",
      rotulo: "Documentos de habilitação",
      valor: docs.valor.length === 0 ? "Não informado" : `${docs.valor.length} ${docs.valor.length === 1 ? "documento" : "documentos"}`,
      atencao: docs.valor.length === 0,
      trecho: docs.trecho,
      pagina: docs.pagina,
      ...(docs.valor.length > 0 ? { itens: [...docs.valor] } : {}),
    },
  ];
  return linhas;
}

/** Quantas linhas pedem conferência. */
export function contarAtencao(linhas: readonly LinhaExigencia[]): number {
  return linhas.filter((l) => l.atencao).length;
}
