import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { DetalheCompra } from "@/core/types-detalhe";
import { escolherArquivoPrincipal, parecePdf } from "./analise";
import { editalParaMarkdown, textoSuficiente } from "./edital-texto";

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

/** Baixa o PDF principal; null quando é grande demais, não é PDF ou a baixa falha. */
async function baixarPdfBytes(detalhe: DetalheCompra): Promise<Uint8Array | null> {
  const arquivo = escolherArquivoPrincipal(detalhe.arquivos);
  if (!arquivo || !arquivo.url.startsWith("https://")) return null;
  try {
    const resposta = await fetch(arquivo.url, { signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS), cache: "no-store" });
    if (!resposta.ok) return null;
    const declarado = Number(resposta.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_PDF_BYTES) return null;
    const bytes = await lerComLimite(resposta, MAX_PDF_BYTES);
    if (bytes === null || !parecePdf(bytes)) return null;
    return bytes;
  } catch {
    return null;
  }
}

/** Baixa o PDF principal em base64; null quando é grande demais, não é PDF ou a baixa falha. */
export async function baixarPdfPrincipal(detalhe: DetalheCompra): Promise<string | null> {
  const bytes = await baixarPdfBytes(detalhe);
  return bytes === null ? null : Buffer.from(bytes).toString("base64");
}

/** Texto de cada página do PDF; null se o arquivo não abre. */
async function textoPorPagina(bytes: Uint8Array): Promise<string[] | null> {
  try {
    // O leitor consome o buffer que recebe: passa uma cópia para manter o original.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    return text;
  } catch {
    return null;
  }
}

/** Edital pronto para o modelo: texto em Markdown (barato) ou, se o PDF for escaneado, o próprio PDF. */
export type EditalLido = { tipo: "texto"; markdown: string } | { tipo: "pdf"; base64: string };

/**
 * Baixa o PDF principal e tenta virar texto. Sem texto suficiente (PDF escaneado) ou com falha
 * na leitura, devolve o PDF inline como antes. null só quando o PDF não pôde ser baixado.
 */
export async function lerEditalPrincipal(detalhe: DetalheCompra): Promise<EditalLido | null> {
  const bytes = await baixarPdfBytes(detalhe);
  if (bytes === null) return null;
  const paginas = await textoPorPagina(bytes);
  if (paginas !== null) {
    const edital = editalParaMarkdown(paginas);
    if (textoSuficiente(edital)) return { tipo: "texto", markdown: edital.markdown };
  }
  return { tipo: "pdf", base64: Buffer.from(bytes).toString("base64") };
}
