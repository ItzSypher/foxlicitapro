import "server-only";
import { cache } from "react";
import { ufsDeColeta } from "@/core/areas";
import type { PerfilEmpresa } from "@/core/perfil";
import { lerEmpresa } from "@/db/empresas";
import { exigirSessao } from "@/lib/sessao";

/** Perfil de uma empresa pelo id (cron e rotinas sem pedido de usuário). Lança se a empresa não existe. */
export async function perfilDaEmpresa(empresaId: string): Promise<PerfilEmpresa> {
  const empresa = await lerEmpresa(empresaId);
  if (!empresa) throw new Error("Empresa não encontrada.");
  return empresa;
}

const perfilDoPedido = cache(async (empresaId: string): Promise<PerfilEmpresa> => perfilDaEmpresa(empresaId));

/** Perfil da empresa da sessão atual: base de score, recomendação, margens, propostas e resumo. */
export async function perfilAtual(): Promise<PerfilEmpresa> {
  const sessao = await exigirSessao();
  return perfilDoPedido(sessao.empresaId);
}

/** UFs das áreas de atuação da empresa da sessão, para os filtros por estado. Sem o perfil, lista vazia (só valem as UFs dos itens). */
export async function ufsDasAreasAtuais(origem: string): Promise<string[]> {
  try {
    return ufsDeColeta((await perfilAtual()).areas);
  } catch (e) {
    console.error(`[${origem}] áreas da empresa indisponíveis:`, e instanceof Error ? e.message : e);
    return [];
  }
}
