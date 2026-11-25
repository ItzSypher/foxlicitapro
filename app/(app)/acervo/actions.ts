"use server";

import { revalidatePath } from "next/cache";
import { DadosAcervoSchema, LIMITE_ARQUIVO_ACERVO, validarArquivoAcervo } from "@/core/acervo";
import { lerValorEmCentavos } from "@/core/proposta-eventos";
import { atualizarDocumentoAcervo, excluirDocumentoAcervo, inserirNoAcervo, type ArquivoParaGravar } from "@/db/acervo";
import { verificarPermissao } from "@/lib/sessao";

export type ResultadoAcervo = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoExclusao = { ok: true } | { ok: false; erro: string };

const FALHA = "Não foi possível salvar agora. Tente de novo em instantes.";

function campo(dados: FormData, nome: string): string {
  const v = dados.get(nome);
  return typeof v === "string" ? v : "";
}

/** Vazio vira null; "1.234,56" vira 1234.56; texto que não é valor volta undefined. */
function lerValor(texto: string): number | null | undefined {
  if (texto.trim() === "") return null;
  const centavos = lerValorEmCentavos(texto);
  return centavos === null ? undefined : centavos / 100;
}

type ArquivoDoForm = { ok: true; arquivo: ArquivoParaGravar | null | undefined } | { ok: false; erro: string };

/** Arquivo novo (confere o tamanho antes de ler o conteúdo), remoção pedida ou nada (undefined: mantém o atual). */
async function lerArquivo(dados: FormData): Promise<ArquivoDoForm> {
  const enviado = dados.get("arquivo");
  if (enviado instanceof File && enviado.size > 0) {
    if (enviado.size > LIMITE_ARQUIVO_ACERVO) return { ok: false, erro: "O arquivo passa de 4 MB. Envie um menor." };
    const bytes = new Uint8Array(await enviado.arrayBuffer());
    const valido = validarArquivoAcervo(enviado.name, bytes);
    if (!valido.ok) return { ok: false, erro: valido.erro };
    return { ok: true, arquivo: { bytes, tipo: valido.tipo, nome: valido.nome } };
  }
  return { ok: true, arquivo: campo(dados, "removerArquivo") === "1" ? null : undefined };
}

/**
 * Cria (id null) ou edita um documento do acervo. Quem pode: dono e quem tem editar_propostas (o gestor, por padrão).
 * A empresa vem sempre da sessão. O arquivo vai junto, no FormData.
 */
export async function salvarAcervoAction(id: string | null, dados: FormData): Promise<ResultadoAcervo> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const { empresaId, usuarioId } = permissao.sessao;

  const valor = lerValor(campo(dados, "valor"));
  if (valor === undefined) return { ok: false, erro: "Valor inválido. Use o formato 1.500,00." };
  const lido = DadosAcervoSchema.safeParse({
    tipo: campo(dados, "tipo"),
    titulo: campo(dados, "titulo"),
    emissor: campo(dados, "emissor"),
    emissorCnpj: campo(dados, "emissorCnpj"),
    descricao: campo(dados, "descricao"),
    areas: dados.getAll("areas").filter((a): a is string => typeof a === "string"),
    valor,
    periodoInicio: campo(dados, "periodoInicio"),
    periodoFim: campo(dados, "periodoFim"),
    emitidoEm: campo(dados, "emitidoEm"),
    validade: campo(dados, "validade"),
  });
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };

  const arquivo = await lerArquivo(dados);
  if (!arquivo.ok) return { ok: false, erro: arquivo.erro };

  try {
    if (id === null) {
      const novo = await inserirNoAcervo(empresaId, { ...lido.data, arquivo: arquivo.arquivo ?? null, criadoPor: usuarioId });
      revalidatePath("/acervo");
      return { ok: true, id: novo };
    }
    const gravou = await atualizarDocumentoAcervo(empresaId, id, lido.data, arquivo.arquivo);
    if (!gravou) return { ok: false, erro: "Documento não encontrado." };
  } catch (e) {
    console.error("[acervo] gravação falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
  revalidatePath("/acervo");
  return { ok: true, id };
}

export async function excluirAcervoAction(id: string): Promise<ResultadoExclusao> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  try {
    const apagou = await excluirDocumentoAcervo(permissao.sessao.empresaId, id);
    if (!apagou) return { ok: false, erro: "Documento não encontrado." };
  } catch (e) {
    console.error("[acervo] exclusão falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível excluir agora. Tente de novo em instantes." };
  }
  revalidatePath("/acervo");
  return { ok: true };
}
