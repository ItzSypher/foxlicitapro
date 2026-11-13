import { connection } from "next/server";
import { Assistente } from "@/components/assistente/assistente";
import { temPermissao } from "@/core/permissoes";
import { assistenteDisponivel } from "@/lib/gemini";
import { lerSessao } from "@/lib/sessao";

/** Decide no servidor, a cada pedido: sem a chave configurada ou sem permissão, nada aparece. */
export async function AssistenteSeAtivo() {
  await connection();
  if (!assistenteDisponivel()) return null;
  const sessao = await lerSessao();
  return sessao && temPermissao(sessao, "usar_assistente") ? <Assistente /> : null;
}
