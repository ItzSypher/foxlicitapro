import { connection } from "next/server";
import { Assistente } from "@/components/assistente/assistente";
import { assistenteDisponivel } from "@/lib/gemini";

/** Decide no servidor, a cada pedido: sem a chave configurada, nada aparece. */
export async function AssistenteSeAtivo() {
  await connection();
  return assistenteDisponivel() ? <Assistente /> : null;
}
