"use server";

import { z } from "zod";
import { listarAvisos, marcarLido, marcarTodosLidos, type ListaAvisos } from "@/db/avisos";
import { lerSessao } from "@/lib/sessao";

export type RespostaAvisos = ({ ok: true } & ListaAvisos) | { ok: false; erro: string };

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FALHA = "Não foi possível carregar os avisos. Tente de novo.";

/** Avisos da pessoa logada (os dela e os de todos da empresa). */
export async function listarAvisosAction(): Promise<RespostaAvisos> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  try {
    return { ok: true, ...(await listarAvisos(sessao.empresaId, sessao.usuarioId)) };
  } catch (e) {
    console.error("[avisos]", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}

export async function marcarAvisoLidoAction(id: string): Promise<RespostaAvisos> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  const valido = z.uuid().safeParse(id);
  if (!valido.success) return { ok: false, erro: FALHA };
  try {
    await marcarLido(sessao.empresaId, sessao.usuarioId, valido.data);
    return { ok: true, ...(await listarAvisos(sessao.empresaId, sessao.usuarioId)) };
  } catch (e) {
    console.error("[avisos]", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}

export async function marcarTodosLidosAction(): Promise<RespostaAvisos> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  try {
    await marcarTodosLidos(sessao.empresaId, sessao.usuarioId);
    return { ok: true, ...(await listarAvisos(sessao.empresaId, sessao.usuarioId)) };
  } catch (e) {
    console.error("[avisos]", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}
