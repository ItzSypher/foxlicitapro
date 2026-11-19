"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { PERFIS_ALERTA, VALOR_GRANDE_MAXIMO, gerarCodigoAtivacao, linkAtivacao, type EscolhasAlerta } from "@/core/whatsapp-alertas";
import { definirAvisoWhatsapp, definirCodigo, desligarWhatsapp, salvarEscolhasAlerta } from "@/db/whatsapp";
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

export interface EstadoPerfil {
  erro: string | null;
  ok: boolean;
}

const ValorSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v !== "")
  .transform(Number)
  .pipe(z.number().int().min(1).max(VALOR_GRANDE_MAXIMO));

/** Grava o perfil de alerta e as caixinhas da própria pessoa. */
export async function salvarPerfilAlertaAction(_anterior: EstadoPerfil, dados: FormData): Promise<EstadoPerfil> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: ERRO_SESSAO };
  const perfil = z.enum(PERFIS_ALERTA).safeParse(dados.get("perfil"));
  if (!perfil.success) return { ok: false, erro: "Escolha o perfil." };
  const bruto = dados.get("valorGrande");
  const valor = ValorSchema.safeParse(typeof bruto === "string" ? bruto : "");
  if (!valor.success) return { ok: false, erro: "Informe o valor em reais, só números." };
  const marcado = (campo: keyof EscolhasAlerta) => dados.get(campo) === "on";
  const escolhas: EscolhasAlerta = {
    perfil: perfil.data,
    prazos: marcado("prazos"),
    novas: marcado("novas"),
    fechando: marcado("fechando"),
    aguardando: marcado("aguardando"),
    pendencias: marcado("pendencias"),
    movimentos: marcado("movimentos"),
    disputa: marcado("disputa"),
    grandes: marcado("grandes"),
    meta: marcado("meta"),
    valorGrande: valor.data,
  };
  try {
    const ok = await salvarEscolhasAlerta(sessao.empresaId, sessao.usuarioId, escolhas);
    if (!ok) return { ok: false, erro: ERRO_GERAL };
    revalidatePath("/alertas");
    return { ok: true, erro: null };
  } catch (e) {
    console.error("[alertas]", e instanceof Error ? e.message : e);
    return { ok: false, erro: ERRO_GERAL };
  }
}
