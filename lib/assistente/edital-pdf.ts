import "server-only";
import type { DetalheCompra } from "@/core/types-detalhe";
import { escolherArquivoPrincipal, parecePdf } from "./analise";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const TIMEOUT_DOWNLOAD_MS = 25_000;

/** Lê o corpo até o limite; passou dele, cancela a leitura e devolve null. */
async function lerComLimite(resposta: Response, limite: number): Promise<Uint8Array | null> {
  if (!resposta.body) return null;
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > limite) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    pedacos.push(value);
  }
  const inteiro = new Uint8Array(total);
  let posicao = 0;
  for (const p of pedacos) {
    inteiro.set(p, posicao);
    posicao += p.length;
  }
  return inteiro;
}

/** Baixa o PDF principal em base64; null quando é grande demais, não é PDF ou a baixa falha. */
export async function baixarPdfPrincipal(detalhe: DetalheCompra): Promise<string | null> {
  const arquivo = escolherArquivoPrincipal(detalhe.arquivos);
  if (!arquivo || !arquivo.url.startsWith("https://")) return null;
  try {
    const resposta = await fetch(arquivo.url, { signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS), cache: "no-store" });
    if (!resposta.ok) return null;
    const declarado = Number(resposta.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_PDF_BYTES) return null;
    const bytes = await lerComLimite(resposta, MAX_PDF_BYTES);
    if (bytes === null || !parecePdf(bytes)) return null;
    return Buffer.from(bytes).toString("base64");
  } catch {
    return null;
  }
}
