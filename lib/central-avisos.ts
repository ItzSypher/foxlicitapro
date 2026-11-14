import "server-only";
import { planejarEntregas, textoDoAviso, type AvisoNovo } from "@/core/avisos";
import { gravarAviso, listarAvisosRecentes, listarPessoasDeAviso } from "@/db/avisos";
import { enviarEmail, linkAbsoluto, montarEmail } from "@/lib/email";
import { enviarWhatsapp, whatsappConfigurado } from "@/lib/whatsapp";

/**
 * Entrega de avisos: painel (sempre), e-mail e WhatsApp conforme a escolha de cada pessoa.
 * Nunca lança: falha de canal é registrada no log e a entrega segue. Não chama o assistente.
 */

export interface ResultadoEntrega {
  /** Avisos gravados no painel */
  painel: number;
  email: number;
  whatsapp: number;
  /** Envios que falharam (e-mail ou WhatsApp) */
  falhas: number;
}

export const ENTREGA_VAZIA: Readonly<ResultadoEntrega> = { painel: 0, email: 0, whatsapp: 0, falhas: 0 };

async function porEmail(aviso: AvisoNovo, para: string): Promise<"ok" | "ignorado" | "falha"> {
  const { html, texto } = montarEmail({
    titulo: aviso.titulo,
    paragrafos: aviso.corpo === "" ? [aviso.titulo] : [aviso.corpo],
    botao: { rotulo: "Abrir no painel", caminho: aviso.link ?? "/" },
  });
  const r = await enviarEmail({ para: [para], assunto: aviso.titulo, html, texto });
  if (r.ok) return "ok";
  if (r.erro === "e-mail não configurado") return "ignorado";
  console.error("[aviso] e-mail:", r.erro);
  return "falha";
}

async function porWhatsapp(aviso: AvisoNovo, numero: string): Promise<"ok" | "falha"> {
  const texto = aviso.link ? `${textoDoAviso(aviso)}\n${linkAbsoluto(aviso.link)}` : textoDoAviso(aviso);
  const r = await enviarWhatsapp(numero, texto);
  if (r.ok) return "ok";
  console.error("[aviso] whatsapp:", r.erro);
  return "falha";
}

/** Grava no painel os avisos novos (sem repetir os já existentes) e envia pelos canais escolhidos. */
export async function entregarAvisos(empresaId: string, candidatos: ReadonlyArray<AvisoNovo>, agora: Date = new Date()): Promise<ResultadoEntrega> {
  const resultado: ResultadoEntrega = { ...ENTREGA_VAZIA };
  if (candidatos.length === 0) return resultado;
  try {
    const [pessoas, existentes] = await Promise.all([listarPessoasDeAviso(empresaId), listarAvisosRecentes(empresaId, agora)]);
    const entregas = planejarEntregas(candidatos, existentes, pessoas);
    const comWhatsapp = whatsappConfigurado();
    for (const { aviso, paineis, pessoas: alcance } of entregas) {
      try {
        const gravados: Array<string | null> = [];
        for (const destino of paineis) {
          if (await gravarAviso(empresaId, destino, aviso, agora)) gravados.push(destino);
        }
        if (gravados.length === 0) continue;
        resultado.painel += gravados.length;
        const recebem = gravados.includes(null) ? alcance : alcance.filter((p) => gravados.includes(p.id));
        for (const p of recebem) {
          if (p.avisoEmail && p.email !== "") {
            const r = await porEmail(aviso, p.email);
            if (r === "ok") resultado.email += 1;
            else if (r === "falha") resultado.falhas += 1;
          }
          if (comWhatsapp && p.avisoWhatsapp && p.whatsapp !== null) {
            const r = await porWhatsapp(aviso, p.whatsapp);
            if (r === "ok") resultado.whatsapp += 1;
            else resultado.falhas += 1;
          }
        }
      } catch (e) {
        resultado.falhas += 1;
        console.error("[aviso]", e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error("[aviso]", e instanceof Error ? e.message : e);
  }
  return resultado;
}
