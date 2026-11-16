import "server-only";
import {
  achatarParametros,
  calcularResultados,
  lerFiltros,
  lerPeriodo,
  listarLinhas,
  type FiltrosResultados,
  type LinhaResultado,
  type PeriodoResultados,
  type Resultados,
} from "@/core/resultados";
import { lerDadosResultados } from "@/db/resultados";

export interface Relatorio {
  periodo: PeriodoResultados;
  filtros: FiltrosResultados;
  resultados: Resultados;
  linhas: LinhaResultado[];
  /** Pessoas que são responsáveis por alguma licitação da lista, para o filtro */
  pessoas: { id: string; nome: string }[];
}

/** Lê o pipeline da empresa e monta o que a tela, o CSV e a impressão mostram, tudo a partir dos mesmos parâmetros da URL. */
export async function montarRelatorio(
  empresaId: string,
  params: { [chave: string]: string | string[] | undefined },
  agora: Date,
): Promise<Relatorio> {
  const brutos = achatarParametros(params);
  const periodo = lerPeriodo(brutos, agora);
  const filtros = lerFiltros(brutos);
  const dados = await lerDadosResultados(empresaId);

  const nomes = new Map<string, string>();
  for (const i of dados.itens) {
    if (i.responsavelId !== null) nomes.set(i.responsavelId, i.responsavelNome ?? "Sem nome");
  }
  const pessoas = [...nomes].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    periodo,
    filtros,
    resultados: calcularResultados({ agora, periodo, filtros, ...dados }),
    linhas: listarLinhas(dados.itens, periodo, filtros, agora),
    pessoas,
  };
}
