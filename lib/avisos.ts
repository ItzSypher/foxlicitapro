import "server-only";
import { emailsDosOutros, emailsDosUsuarios } from "@/db/usuarios";
import { enviarEmail, montarEmail } from "@/lib/email";

/**
 * Avisos por e-mail do fluxo de equipe. Chamados dentro de `after()`: nunca lançam erro,
 * só registram no log quando o envio falha (e-mail não configurado não é falha).
 */

async function disparar(para: string[], assunto: string, modelo: Parameters<typeof montarEmail>[0]): Promise<void> {
  if (para.length === 0) return;
  try {
    const { html, texto } = montarEmail(modelo);
    const r = await enviarEmail({ para, assunto, html, texto });
    if (!r.ok && r.erro !== "e-mail não configurado") console.error("[email]", r.erro);
  } catch (e) {
    console.error("[email]", e instanceof Error ? e.message : e);
  }
}

export async function avisarPropostaEmRevisao(p: { empresaId: string; id: string; titulo: string; autorId: string; autorNome: string }): Promise<void> {
  const para = await emailsDosOutros(p.empresaId, p.autorId).catch(() => []);
  await disparar(para, `Proposta para revisar: ${p.titulo}`, {
    titulo: "Proposta para revisar",
    paragrafos: [`${p.autorNome} enviou a proposta "${p.titulo}" para revisão.`],
    botao: { rotulo: "Abrir proposta", caminho: `/propostas/${p.id}` },
  });
}

export async function avisarPropostaRevisada(p: {
  empresaId: string;
  id: string;
  titulo: string;
  autorId: string | null;
  revisorId: string;
  revisorNome: string;
  aprovada: boolean;
  nota: string | null;
}): Promise<void> {
  if (p.autorId === null || p.autorId === p.revisorId) return;
  const para = await emailsDosUsuarios(p.empresaId, [p.autorId]).catch(() => []);
  await disparar(para, `${p.aprovada ? "Proposta aprovada" : "Proposta devolvida"}: ${p.titulo}`, {
    titulo: p.aprovada ? "Proposta aprovada" : "Proposta devolvida",
    paragrafos: [
      p.aprovada
        ? `${p.revisorNome} aprovou a proposta "${p.titulo}".`
        : `${p.revisorNome} devolveu a proposta "${p.titulo}" com ajustes.`,
    ],
    destaque: !p.aprovada && p.nota ? p.nota : undefined,
    botao: { rotulo: "Abrir proposta", caminho: `/propostas/${p.id}` },
  });
}

export async function avisarResponsavel(p: { empresaId: string; itemId: string; objeto: string; responsavelId: string; porNome: string }): Promise<void> {
  const para = await emailsDosUsuarios(p.empresaId, [p.responsavelId]).catch(() => []);
  const objeto = p.objeto.length > 140 ? `${p.objeto.slice(0, 139)}…` : p.objeto;
  await disparar(para, "Você é o responsável por uma oportunidade", {
    titulo: "Você é o responsável por uma oportunidade",
    paragrafos: [`${p.porNome} passou para você a oportunidade "${objeto}".`],
    botao: { rotulo: "Abrir pipeline", caminho: "/pipeline" },
  });
}
