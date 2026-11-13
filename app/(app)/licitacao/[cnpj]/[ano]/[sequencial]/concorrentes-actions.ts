"use server";

import { revalidatePath } from "next/cache";
import { montarResultado, type ResultadoConcorrentes } from "@/core/concorrentes";
import { buscarHomologadas } from "@/core/pncp/concorrentes";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { lerChaveCompra } from "@/core/proposta";
import { gravarAmostras, gravarBusca, lerAmostrasEmCache, lerBuscaRecente } from "@/db/concorrentes";
import { verificarPermissao } from "@/lib/sessao";

export type RespostaConcorrentes =
  | { ok: true; resultado: ResultadoConcorrentes; buscadoEm: string | null; aviso: string | null }
  | { ok: false; erro: string };

/**
 * Busca no PNCP contratações parecidas já homologadas e guarda no cache por 7 dias.
 * Dentro de 7 dias da última busca desta licitação, usa o cache (sem chamar o PNCP), salvo `atualizar`.
 * Exige permissão de editar propostas (grava cache e chama serviço externo).
 */
export async function buscarConcorrentesAction(compra: string, atualizar: boolean): Promise<RespostaConcorrentes> {
  const acesso = await verificarPermissao("editar_propostas");
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  const chave = lerChaveCompra(typeof compra === "string" ? compra : "");
  if (!chave) return { ok: false, erro: "Licitação inválida." };

  try {
    const detalhe = await buscarDetalheCompra(chave);
    if (detalhe === null) return { ok: false, erro: "Esta licitação não foi encontrada." };

    let aviso: string | null = null;
    let busca = await lerBuscaRecente(detalhe.numeroControle);
    if (busca === null || atualizar === true) {
      const r = await buscarHomologadas(detalhe.uf, detalhe.modalidadeId);
      if (r.amostras.length > 0) await gravarAmostras(r.amostras);
      if (r.requisicoes > r.falhas) {
        await gravarBusca(detalhe.numeroControle, r.requisicoes, r.falhas);
        busca = await lerBuscaRecente(detalhe.numeroControle);
      }
      if (r.limitado) aviso = "O PNCP limitou as consultas e a busca parou antes do fim. Tente de novo em alguns minutos.";
      else if (r.falhas > 0) aviso = `${r.falhas} de ${r.requisicoes} consultas ao PNCP falharam. O resultado pode estar incompleto.`;
      else if (r.requisicoes === 0) aviso = "Não foi possível consultar o PNCP agora.";
    }

    const amostras = await lerAmostrasEmCache();
    revalidatePath(`/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`);
    return {
      ok: true,
      resultado: montarResultado(amostras, detalhe.objeto, detalhe.uf, detalhe.numeroControle, detalhe.valorEstimado),
      buscadoEm: busca?.buscadoEm ?? null,
      aviso,
    };
  } catch (e) {
    console.error("[concorrentes]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível buscar os preços agora. Tente de novo." };
  }
}
