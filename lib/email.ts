import "server-only";

/** E-mails transacionais pela API REST do Resend. Sem as variáveis de ambiente, não envia e não quebra nada. */

const BASE_PADRAO = "https://licitapro.foxtisolutions.com.br";
const ENDPOINT = "https://api.resend.com/emails";

export interface EntradaEmail {
  para: string[];
  assunto: string;
  html: string;
  texto: string;
}

export interface ResultadoEmail {
  ok: boolean;
  erro?: string;
}

export function baseUrl(): string {
  const definida = process.env.APP_URL?.trim();
  return (definida && definida !== "" ? definida : BASE_PADRAO).replace(/\/+$/, "");
}

export function linkAbsoluto(caminho: string): string {
  return `${baseUrl()}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function enviarEmail(entrada: EntradaEmail): Promise<ResultadoEmail> {
  const chave = process.env.RESEND_API_KEY?.trim();
  const remetente = process.env.RESEND_FROM?.trim();
  if (!chave || !remetente) return { ok: false, erro: "e-mail não configurado" };

  const para = [...new Set(entrada.para.map((e) => e.trim()).filter((e) => e !== ""))];
  if (para.length === 0) return { ok: false, erro: "sem destinatário" };

  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: para,
        subject: entrada.assunto,
        html: entrada.html,
        text: entrada.texto,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (resposta.ok) return { ok: true };
    const corpo: unknown = await resposta.json().catch(() => null);
    const mensagem =
      typeof corpo === "object" && corpo !== null && "message" in corpo && typeof corpo.message === "string"
        ? corpo.message
        : `falha ${resposta.status}`;
    return { ok: false, erro: mensagem };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha ao enviar" };
  }
}

export interface ModeloEmail {
  titulo: string;
  /** Um parágrafo por item; texto puro */
  paragrafos: string[];
  /** Destaque opcional (ex.: nota do revisor) */
  destaque?: string;
  botao: { rotulo: string; caminho: string };
}

/** Fundo branco, logo, botão laranja com texto preto. Devolve também a versão em texto. */
export function montarEmail(modelo: ModeloEmail): { html: string; texto: string } {
  const link = linkAbsoluto(modelo.botao.caminho);
  const paragrafos = modelo.paragrafos
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#111111;">${escaparHtml(p)}</p>`)
    .join("");
  const destaque = modelo.destaque
    ? `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #F57E11;background:#f6f6f5;font-size:14px;line-height:1.5;color:#111111;">${escaparHtml(modelo.destaque)}</blockquote>`
    : "";
  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:20px;"><img src="${BASE_PADRAO}/raposa.svg" width="40" height="40" alt="FoxLicita Pro" style="display:block;border:0;"></td></tr>
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111111;">${escaparHtml(modelo.titulo)}</h1>
${paragrafos}${destaque}
<a href="${escaparHtml(link)}" style="display:inline-block;padding:12px 20px;background:#F57E11;color:#000000;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">${escaparHtml(modelo.botao.rotulo)}</a>
</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#5c5c5a;">FoxLicita Pro</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const texto = [
    modelo.titulo,
    "",
    ...modelo.paragrafos,
    ...(modelo.destaque ? ["", `"${modelo.destaque}"`] : []),
    "",
    `${modelo.botao.rotulo}: ${link}`,
  ].join("\n");
  return { html, texto };
}
