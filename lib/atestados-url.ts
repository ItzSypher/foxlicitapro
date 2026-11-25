import "server-only";
import {
  BASE_PADRAO_APP,
  linkWhatsApp,
  mensagemWhatsAppAtestado,
  podeGerarLink,
  telefoneDoContato,
  urlAtestadoPublico,
} from "@/core/atestados";
import type { Atestado } from "@/db/atestados";

/** Endereço público do sistema (APP_URL, ou o padrão), sem barra final. */
export function baseDoApp(): string {
  const definida = process.env.APP_URL?.trim();
  return (definida && definida !== "" ? definida : BASE_PADRAO_APP).replace(/\/+$/, "");
}

/** Link do cliente e endereço do WhatsApp com a mensagem pronta; null enquanto não há link válido. */
export function linkParaEnvio(a: Atestado, emissora: string): { url: string; whatsapp: string } | null {
  if (!podeGerarLink(a.status) || a.status !== "aguardando" || !a.linkValido || a.token === null) return null;
  const url = urlAtestadoPublico(baseDoApp(), a.token);
  const texto = mensagemWhatsAppAtestado({ cliente: a.clienteNome, emissora, link: url, responsavel: a.responsavelNome });
  return { url, whatsapp: linkWhatsApp(texto, telefoneDoContato(a.responsavelContato)) };
}
