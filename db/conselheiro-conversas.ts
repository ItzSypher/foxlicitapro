import "server-only";
import {
  MAX_CONVERSAS_NA_LISTA,
  MAX_MENSAGENS_AO_CONTINUAR,
  idDeConversaValido,
  textoParaGravar,
  tituloDaConversa,
  type ConversaAberta,
  type PapelMensagem,
  type ResumoConversa,
} from "@/lib/conselheiro/historico";
import { sql } from "./client";

/** Conversas do chat: cada pessoa só lê, continua e apaga as próprias, dentro da empresa dela. */

/** Conversas da pessoa, da mais recente para a mais antiga. */
export async function listarConversas(empresaId: string, usuarioId: string): Promise<ResumoConversa[]> {
  const linhas = await sql<Array<{ id: string; titulo: string; atualizado_em: Date; mensagens: number }>>`
    select c.id, c.titulo, c.atualizado_em,
      (select count(*)::int from conselheiro_mensagens m where m.conversa_id = c.id) as mensagens
    from conselheiro_conversas c
    where c.empresa_id = ${empresaId} and c.usuario_id = ${usuarioId}
    order by c.atualizado_em desc
    limit ${MAX_CONVERSAS_NA_LISTA}`;
  return linhas.map((l) => ({ id: l.id, titulo: l.titulo, atualizadoEm: l.atualizado_em.toISOString(), mensagens: l.mensagens }));
}

/** Conversa com as mensagens mais recentes, em ordem. Conversa de outra pessoa ou empresa volta como ausente. */
export async function lerConversa(empresaId: string, usuarioId: string, conversaId: string): Promise<ConversaAberta | null> {
  if (!idDeConversaValido(conversaId)) return null;
  const [conversa] = await sql<Array<{ id: string; titulo: string }>>`
    select id, titulo from conselheiro_conversas
    where id = ${conversaId} and empresa_id = ${empresaId} and usuario_id = ${usuarioId}`;
  if (!conversa) return null;
  const linhas = await sql<Array<{ papel: PapelMensagem; texto: string }>>`
    select papel, texto from (
      select id, papel, texto from conselheiro_mensagens
      where conversa_id = ${conversa.id}
      order by id desc
      limit ${MAX_MENSAGENS_AO_CONTINUAR}
    ) recentes
    order by id`;
  return { id: conversa.id, titulo: conversa.titulo, mensagens: linhas.map((l) => ({ papel: l.papel, texto: l.texto })) };
}

/**
 * Grava a pergunta e a resposta de uma troca e devolve o id da conversa.
 * Sem conversa (ou com uma que não é da pessoa), abre outra com o título tirado da pergunta.
 */
export async function registrarTroca(
  empresaId: string,
  usuarioId: string,
  d: { conversaId: string | null; pergunta: string; resposta: string; rota: string },
): Promise<string> {
  const pergunta = textoParaGravar(d.pergunta);
  const resposta = textoParaGravar(d.resposta);
  const rota = d.rota.slice(0, 300);
  return sql.begin(async (tx) => {
    let id: string | null = null;
    if (d.conversaId !== null && idDeConversaValido(d.conversaId)) {
      const [atual] = await tx<{ id: string }[]>`
        update conselheiro_conversas set atualizado_em = now()
        where id = ${d.conversaId} and empresa_id = ${empresaId} and usuario_id = ${usuarioId}
        returning id`;
      id = atual?.id ?? null;
    }
    if (id === null) {
      const [nova] = await tx<{ id: string }[]>`
        insert into conselheiro_conversas (empresa_id, usuario_id, titulo)
        values (${empresaId}, ${usuarioId}, ${tituloDaConversa(pergunta)})
        returning id`;
      if (!nova) throw new Error("A conversa não foi criada");
      id = nova.id;
    }
    await tx`
      insert into conselheiro_mensagens (conversa_id, papel, texto, rota)
      values (${id}, 'usuario', ${pergunta}, ${rota}), (${id}, 'assistente', ${resposta}, ${rota})`;
    return id;
  });
}

/** Apaga a conversa e as mensagens dela. Devolve false quando não era da pessoa ou já não existia. */
export async function apagarConversa(empresaId: string, usuarioId: string, conversaId: string): Promise<boolean> {
  if (!idDeConversaValido(conversaId)) return false;
  const linhas = await sql`
    delete from conselheiro_conversas
    where id = ${conversaId} and empresa_id = ${empresaId} and usuario_id = ${usuarioId}
    returning id`;
  return linhas.length > 0;
}
