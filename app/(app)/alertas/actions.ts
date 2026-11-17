"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { gerarCodigoAtivacao, linkAtivacao } from "@/core/whatsapp-alertas";
import { definirAvisoWhatsapp, definirCodigo, desligarWhatsapp } from "@/db/whatsapp";
import { lerSessao } from "@/lib/sessao";
import { garantirWebhookConfigurado } from "@/lib/whatsapp-alertas-cron";

const VALIDADE_MS = 30 * 60_000;
const TENTATIVAS = 3;
const NUMERO_PADRAO = "5521969418669";

export type ResultadoCodigo = { ok: true; codigo: string; link: string; expiraEm: string } | { ok: false; erro: string };
export type ResultadoSimples = { ok: true } | { ok: false; erro: string };

const ERRO_SESSAO = "Sessão expirada. Entre de novo.";
const ERRO_GERAL = "Não foi possível agora. Tente de novo em instantes.";

/** Cria um código de ativação válido por 30 minutos e devolve o link que abre o WhatsApp com a mensagem pronta. */
export async function gerarCodigoAction(): Promise<ResultadoCodigo> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: ERRO_SESSAO };
  try {
    const expira = new Date(Date.now() + VALIDADE_MS);
    for (let i = 0; i < TENTATIVAS; i += 1) {
      const codigo = gerarCodigoAtivacao(() => randomInt(0, 1_000_000) / 1_000_000);
      if (await definirCodigo(sessao.empresaId, sessao.usuarioId, codigo, expira)) {
        after(async () => {
          try {
            await garantirWebhookConfigurado();
          } catch (e) {
            console.error("[alertas]", e instanceof Error ? e.message : e);
          }
        });
        revalidatePath("/alertas");
        const numero = process.env.ZERNIO_WHATSAPP_NUMERO ?? NUMERO_PADRAO;
        return { ok: true, codigo, link: linkAtivacao(numero, codigo), expiraEm: expira.toISOString() };
      }
    }
    return { ok: false, erro: ERRO_GERAL };
  } catch (e) {
    console.error("[alertas]", e instanceof Error ? e.message : e);
    return { ok: false, erro: ERRO_GERAL };
  }
}

async function alterarAviso(ativo: boolean): Promise<ResultadoSimples> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: ERRO_SESSAO };
  try {
    await definirAvisoWhatsapp(sessao.usuarioId, ativo);
    revalidatePath("/alertas");
    return { ok: true };
  } catch (e) {
    console.error("[alertas]", e instanceof Error ? e.message : e);
    return { ok: false, erro: ERRO_GERAL };
  }
}

export async function pausarAction(): Promise<ResultadoSimples> {
  return alterarAviso(false);
}

export async function religarAction(): Promise<ResultadoSimples> {
  return alterarAviso(true);
}

export async function desligarAction(): Promise<ResultadoSimples> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: ERRO_SESSAO };
  try {
    await desligarWhatsapp(sessao.empresaId, sessao.usuarioId);
    revalidatePath("/alertas");
    return { ok: true };
  } catch (e) {
    console.error("[alertas]", e instanceof Error ? e.message : e);
    return { ok: false, erro: ERRO_GERAL };
  }
}
