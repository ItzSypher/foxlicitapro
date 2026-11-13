"use server";

import { revalidatePath } from "next/cache";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { lerChaveCompra } from "@/core/proposta";
import type { FichaSalva } from "@/core/ficha";
import { confirmarFicha, lerFicha } from "@/db/fichas";
import { obterFichaEdital, type ResultadoFicha } from "@/lib/assistente/ficha";
import { temPermissao } from "@/core/permissoes";
import { SEM_PERMISSAO, lerSessao, verificarPermissao } from "@/lib/sessao";

/**
 * Lê o edital com o assistente e guarda a ficha (uma por edital, para toda a equipe).
 * `regenerar` falso devolve a ficha guardada, se houver. O proxy já exige sessão; aqui de novo,
 * porque uma server action pode ser chamada por qualquer rota liberada.
 */
export async function lerEditalAction(compra: string, regenerar: boolean): Promise<ResultadoFicha> {
  const acesso = await verificarPermissao("usar_assistente");
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  const sessao = acesso.sessao;
  const chave = lerChaveCompra(typeof compra === "string" ? compra : "");
  if (!chave) return { ok: false, erro: "Licitação inválida." };
  const resultado = await obterFichaEdital(chave, sessao, regenerar === true);
  if (resultado.ok) revalidatePath(`/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`);
  return resultado;
}

/** Marca a ficha como conferida pela pessoa logada. */
export async function confirmarFichaAction(compra: string): Promise<ResultadoFicha> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (!temPermissao(sessao, "revisao_juridica") && !temPermissao(sessao, "editar_propostas")) {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  const chave = lerChaveCompra(typeof compra === "string" ? compra : "");
  if (!chave) return { ok: false, erro: "Licitação inválida." };

  let id: string;
  try {
    const detalhe = await buscarDetalheCompra(chave);
    if (detalhe === null) return { ok: false, erro: "Esta licitação não foi encontrada." };
    id = detalhe.numeroControle;
  } catch {
    return { ok: false, erro: "Não foi possível ler os dados da licitação agora. Tente de novo." };
  }

  let salva: FichaSalva | null;
  try {
    const marcada = await confirmarFicha(id, sessao.usuarioId);
    if (!marcada) return { ok: false, erro: "A ficha ainda não foi gerada. Leia o edital primeiro." };
    salva = await lerFicha(id);
  } catch {
    return { ok: false, erro: "Não foi possível confirmar a ficha agora. Tente de novo." };
  }
  if (salva === null) return { ok: false, erro: "A ficha ainda não foi gerada. Leia o edital primeiro." };
  revalidatePath(`/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`);
  return { ok: true, ficha: salva };
}
