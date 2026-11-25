"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErroConsultaCnpj, consultarCnpj } from "@/core/brasilapi";
import {
  CamposAtestadoSchema,
  DadosAtestadoSchema,
  LIMITE_ARQUIVO_BYTES,
  linkWhatsApp,
  mensagemWhatsAppAtestado,
  telefoneDoContato,
  urlAtestadoPublico,
} from "@/core/atestados";
import { anexarArquivoAssinado, atualizarAtestado, cancelarAtestado, criarAtestado, gerarLink, lerAtestado } from "@/db/atestados";
import { lerEmpresa } from "@/db/empresas";
import { redigirAtestado } from "@/lib/assistente/atestado";
import { baseDoApp } from "@/lib/atestados-url";
import { verificarPermissao } from "@/lib/sessao";

const FALHA = "Não foi possível concluir agora. Tente de novo em instantes.";

export type ResultadoSalvar = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoSimples = { ok: true } | { ok: false; erro: string };
export type ResultadoLink = { ok: true; url: string; whatsapp: string } | { ok: false; erro: string };
export type ResultadoRedigir = { ok: true; texto: string; aviso: string | null } | { ok: false; erro: string };
export type ResultadoCnpj = { ok: true; razaoSocial: string; endereco: string | null } | { ok: false; erro: string };

function atualizarTelas(id?: string): void {
  revalidatePath("/atestados");
  if (id) revalidatePath(`/atestados/${id}`);
}

/** Criar e editar exigem editar_propostas (o dono passa sempre, o gestor tem por padrão); a empresa vem sempre da sessão. */
export async function salvarAtestadoAction(id: string | null, entrada: unknown): Promise<ResultadoSalvar> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const lido = DadosAtestadoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  const { empresaId, usuarioId } = permissao.sessao;
  try {
    if (id === null) {
      const novo = await criarAtestado(empresaId, usuarioId, lido.data);
      atualizarTelas();
      return { ok: true, id: novo };
    }
    const gravou = await atualizarAtestado(empresaId, id, lido.data);
    if (!gravou) return { ok: false, erro: "Este atestado não pode mais ser editado." };
    atualizarTelas(id);
    return { ok: true, id };
  } catch (e) {
    console.error("[atestados] gravação falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}

/** Link do cliente (cria na primeira vez, reaproveita enquanto vale) e o endereço do WhatsApp com a mensagem pronta. */
export async function gerarLinkAction(id: string, renovar = false): Promise<ResultadoLink> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const { empresaId } = permissao.sessao;
  try {
    const atestado = await lerAtestado(empresaId, id);
    if (!atestado) return { ok: false, erro: "Atestado não encontrado." };
    const link = await gerarLink(empresaId, id, renovar);
    if (!link) return { ok: false, erro: "Só atestados em rascunho ou aguardando assinatura têm link." };
    const empresa = await lerEmpresa(empresaId);
    const url = urlAtestadoPublico(baseDoApp(), link.token);
    const texto = mensagemWhatsAppAtestado({
      cliente: atestado.clienteNome,
      emissora: empresa?.nomeFantasia ?? empresa?.razaoSocial ?? "nossa empresa",
      link: url,
      responsavel: atestado.responsavelNome,
    });
    atualizarTelas(id);
    return { ok: true, url, whatsapp: linkWhatsApp(texto, telefoneDoContato(atestado.responsavelContato)) };
  } catch (e) {
    console.error("[atestados] link falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}

export async function cancelarAtestadoAction(id: string): Promise<ResultadoSimples> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  try {
    const cancelou = await cancelarAtestado(permissao.sessao.empresaId, id);
    if (!cancelou) return { ok: false, erro: "Só atestados em rascunho ou aguardando assinatura podem ser cancelados." };
  } catch (e) {
    console.error("[atestados] cancelamento falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
  atualizarTelas(id);
  return { ok: true };
}

const RedacaoSchema = CamposAtestadoSchema.pick({
  clienteNome: true,
  clienteCnpj: true,
  objeto: true,
  periodoInicio: true,
  periodoFim: true,
  valor: true,
}).extend({ descricao: z.string().trim().max(4000).default("") });

/** "Redigir com o assistente": a partir dos serviços descritos; sem assistente usa o modelo padrão. */
export async function redigirAtestadoAction(entrada: unknown): Promise<ResultadoRedigir> {
  const permissao = await verificarPermissao("usar_assistente");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const lido = RedacaoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Preencha o cliente e os serviços antes." };
  const r = await redigirAtestado(permissao.sessao, { ...lido.data, descricao: lido.data.descricao || lido.data.objeto });
  return r.ok ? { ok: true, texto: r.texto, aviso: r.aviso } : { ok: false, erro: r.erro };
}

/** Busca razão social e endereço do cliente na BrasilAPI pelo CNPJ. */
export async function consultarCnpjClienteAction(cnpj: string): Promise<ResultadoCnpj> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  try {
    const e = await consultarCnpj(String(cnpj).slice(0, 30));
    const local = [e.municipio, e.uf].filter((p) => p !== "").join(" - ");
    const endereco = [e.endereco, local, e.cep ? `CEP ${e.cep}` : ""].filter((p) => p !== null && p !== "").join(", ");
    return { ok: true, razaoSocial: e.razaoSocial, endereco: endereco === "" ? null : endereco };
  } catch (e) {
    if (e instanceof ErroConsultaCnpj) return { ok: false, erro: e.message };
    console.error("[atestados] consulta de CNPJ falhou:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: "Não foi possível consultar o CNPJ agora." };
  }
}

/** PDF assinado fora do sistema (gov.br): até 4 MB; entra no acervo junto do atestado. */
export async function anexarPdfAssinadoAction(id: string, dados: FormData): Promise<ResultadoSimples> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha o arquivo PDF." };
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return { ok: false, erro: "O PDF passa de 4 MB. Use um arquivo menor." };
  try {
    const r = await anexarArquivoAssinado(permissao.sessao.empresaId, id, Buffer.from(await arquivo.arrayBuffer()));
    if (!r.ok) {
      const erros = {
        "nao-encontrado": "Atestado não encontrado.",
        cancelado: "Atestado cancelado não recebe arquivo.",
        grande: "O PDF passa de 4 MB. Use um arquivo menor.",
        formato: "O arquivo precisa ser um PDF.",
      } as const;
      return { ok: false, erro: erros[r.motivo] };
    }
  } catch (e) {
    console.error("[atestados] anexo falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
  atualizarTelas(id);
  revalidatePath("/acervo");
  return { ok: true };
}
