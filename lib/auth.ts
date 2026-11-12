/**
 * Sessão assinada com HMAC-SHA256 (Web Crypto). Funciona no proxy e nas server actions.
 * Formato do token: "<expiraEmMs>.<nonce>.<assinaturaBase64Url>".
 */

export const COOKIE_SESSAO = "fox_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

export interface ConfigAcesso {
  senha: string;
  segredo: string;
}

/** Retorna null quando APP_PASSWORD ou APP_SECRET não estão definidos. */
export function lerConfigAcesso(): ConfigAcesso | null {
  const senha = process.env.APP_PASSWORD;
  const segredo = process.env.APP_SECRET;
  if (!senha || !segredo) return null;
  return { senha, segredo };
}

function paraBase64Url(bytes: Uint8Array): string {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(valor: string): Uint8Array<ArrayBuffer> | null {
  try {
    const normal = valor.replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = normal + "=".repeat((4 - (normal.length % 4)) % 4);
    const texto = atob(preenchido);
    const bytes = new Uint8Array(texto.length);
    for (let i = 0; i < texto.length; i += 1) bytes[i] = texto.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importarChave(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function assinar(segredo: string, dados: string): Promise<Uint8Array<ArrayBuffer>> {
  const chave = await importarChave(segredo);
  const assinatura = await crypto.subtle.sign("HMAC", chave, encoder.encode(dados));
  return new Uint8Array(assinatura);
}

/** Comparação em tempo constante para dois vetores de bytes. */
function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  let diferenca = a.length ^ b.length;
  const tamanho = Math.max(a.length, b.length);
  for (let i = 0; i < tamanho; i += 1) {
    diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diferenca === 0;
}

/** Compara duas senhas sem vazar o tamanho nem o ponto da primeira diferença. */
export async function senhaConfere(informada: string, esperada: string, segredo: string): Promise<boolean> {
  const [a, b] = await Promise.all([assinar(segredo, informada), assinar(segredo, esperada)]);
  return iguaisEmTempoConstante(a, b);
}

export async function criarToken(segredo: string, agora: number = Date.now()): Promise<string> {
  const expiraEm = agora + DURACAO_SESSAO_SEGUNDOS * 1000;
  const nonce = paraBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const carga = `${expiraEm}.${nonce}`;
  const assinatura = await assinar(segredo, carga);
  return `${carga}.${paraBase64Url(assinatura)}`;
}

export async function tokenValido(
  token: string | undefined,
  segredo: string | undefined,
  agora: number = Date.now(),
): Promise<boolean> {
  if (!token || !segredo) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [expira, nonce, assinaturaTexto] = partes;
  const expiraEm = Number(expira);
  if (!Number.isFinite(expiraEm)) return false;
  const recebida = deBase64Url(assinaturaTexto);
  if (!recebida) return false;
  const esperada = await assinar(segredo, `${expira}.${nonce}`);
  if (!iguaisEmTempoConstante(recebida, esperada)) return false;
  return expiraEm > agora;
}
