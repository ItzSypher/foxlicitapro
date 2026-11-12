import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { Papel, Sessao } from "@/core/types-equipe";

/**
 * Senha por usuário (scrypt) e sessão assinada com HMAC-SHA256 (Web Crypto).
 * O proxy roda no Node.js: este arquivo não importa nada que dependa do banco.
 *
 * Formato da senha guardada: "scrypt$N$r$p$salt$hash" (salt e hash em base64url).
 * Formato do token: "<cargaBase64Url>.<assinaturaBase64Url>", com a carga em JSON { u, p, n, e }.
 */

export const COOKIE_SESSAO = "fox_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const TAMANHO_SAL = 16;
const TAMANHO_HASH = 32;
/** Teto aceito ao ler um hash guardado: evita que um valor adulterado no banco consuma memória demais. */
const SCRYPT_N_MAXIMO = 1 << 17;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function scryptAsync(senha: string, sal: Buffer, n: number, r: number, p: number, tamanho: number): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha.normalize("NFKC"), sal, tamanho, { N: n, r, p, maxmem: 256 * n * r }, (erro, chave) => {
      if (erro) rejeitar(erro);
      else resolver(chave);
    });
  });
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const hash = await scryptAsync(senha, sal, SCRYPT_N, SCRYPT_R, SCRYPT_P, TAMANHO_HASH);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, sal.toString("base64url"), hash.toString("base64url")].join("$");
}

/** Compara em tempo constante. Hash malformado vale como senha errada. */
export async function verificarSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const n = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  const sal = Buffer.from(partes[4] ?? "", "base64url");
  const esperado = Buffer.from(partes[5] ?? "", "base64url");
  const parametrosValidos =
    Number.isInteger(n) && n >= 2 && n <= SCRYPT_N_MAXIMO && (n & (n - 1)) === 0 &&
    Number.isInteger(r) && r >= 1 && r <= 32 &&
    Number.isInteger(p) && p >= 1 && p <= 4;
  if (!parametrosValidos || sal.length === 0 || esperado.length === 0) return false;
  try {
    const calculado = await scryptAsync(senha, sal, n, r, p, esperado.length);
    return timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

let hashFalso: Promise<string> | null = null;

/** Gasta o mesmo tempo de uma verificação real quando o e-mail não existe, para não revelar quem tem conta. */
export async function gastarTempoDeVerificacao(senha: string): Promise<void> {
  hashFalso ??= hashSenha("senha-que-nunca-sera-usada");
  await verificarSenha(senha, await hashFalso);
}

/** Igualdade de textos em tempo constante (compara os resumos SHA-256, que têm tamanho fixo). */
export function textosIguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Sem caracteres ambíguos (0/O, 1/l/I) para facilitar ditar a senha por telefone. */
const ALFABETO_SENHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarSenhaInicial(tamanho = 14): string {
  let senha = "";
  for (let i = 0; i < tamanho; i += 1) senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  return senha;
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

async function assinar(segredo: string, dados: string): Promise<Uint8Array<ArrayBuffer>> {
  const chave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", chave, encoder.encode(dados)));
}

function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  let diferenca = a.length ^ b.length;
  const tamanho = Math.max(a.length, b.length);
  for (let i = 0; i < tamanho; i += 1) diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferenca === 0;
}

function ehPapel(valor: unknown): valor is Papel {
  return valor === "dono" || valor === "gestor";
}

export async function criarToken(segredo: string, sessao: Sessao, agora: number = Date.now()): Promise<string> {
  const carga = paraBase64Url(
    encoder.encode(
      JSON.stringify({ u: sessao.usuarioId, p: sessao.papel, n: sessao.nome, e: agora + DURACAO_SESSAO_SEGUNDOS * 1000 }),
    ),
  );
  return `${carga}.${paraBase64Url(await assinar(segredo, carga))}`;
}

/** A sessão do token, ou null se ausente, adulterado ou vencido. */
export async function lerToken(
  token: string | undefined,
  segredo: string | undefined,
  agora: number = Date.now(),
): Promise<Sessao | null> {
  if (!token || !segredo) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [carga, assinaturaTexto] = partes;
  const recebida = deBase64Url(assinaturaTexto);
  if (!recebida) return null;
  if (!iguaisEmTempoConstante(recebida, await assinar(segredo, carga))) return null;

  const bytes = deBase64Url(carga);
  if (!bytes) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (typeof bruto !== "object" || bruto === null) return null;
  const { u, p, n, e } = bruto as Record<string, unknown>;
  if (typeof u !== "string" || u === "" || typeof n !== "string" || !ehPapel(p)) return null;
  if (typeof e !== "number" || !Number.isFinite(e) || e <= agora) return null;
  return { usuarioId: u, nome: n, papel: p };
}
