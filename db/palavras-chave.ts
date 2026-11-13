import "server-only";
import { sql } from "@/db/client";

/** Quantas palavras-chave cada pessoa pode guardar. */
export const MAX_PALAVRAS_SALVAS = 30;
export const MAX_TAMANHO_PALAVRA = 60;

export async function listarPalavrasChave(usuarioId: string): Promise<string[]> {
  const linhas = await sql<{ termo: string }[]>`
    select termo from palavras_chave where usuario_id = ${usuarioId} order by criado_em asc, termo asc
  `;
  return linhas.map((l) => l.termo);
}

/** Guarda o termo (já normalizado). Devolve false quando a pessoa já está no limite. Termo repetido não muda nada. */
export async function adicionarPalavraChave(usuarioId: string, termo: string): Promise<boolean> {
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from palavras_chave where usuario_id = ${usuarioId}
  `;
  if (total >= MAX_PALAVRAS_SALVAS) {
    const [existe] = await sql<{ um: number }[]>`
      select 1 as um from palavras_chave where usuario_id = ${usuarioId} and termo = ${termo}
    `;
    return existe !== undefined;
  }
  await sql`
    insert into palavras_chave (usuario_id, termo) values (${usuarioId}, ${termo})
    on conflict (usuario_id, termo) do nothing
  `;
  return true;
}

export async function removerPalavraChave(usuarioId: string, termo: string): Promise<void> {
  await sql`delete from palavras_chave where usuario_id = ${usuarioId} and termo = ${termo}`;
}
