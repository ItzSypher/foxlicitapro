/**
 * Linha do tempo da proposta (quem fez o quê e quando), comprovante de envio e registro de proposta
 * enviada fora do sistema. Funções puras, sem banco: valem no servidor e no navegador.
 */
import type { ResultadoApurado } from "./proposta-resultado";

export const TIPOS_EVENTO = ["criada", "revisao", "devolvida", "aprovada", "enviada", "resultado"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  criada: "Criada",
  revisao: "Enviada para revisão",
  devolvida: "Devolvida com ajustes",
  aprovada: "Aprovada",
  enviada: "Enviada ao órgão",
  resultado: "Resultado",
};

export function ehTipoEvento(valor: unknown): valor is TipoEvento {
  return typeof valor === "string" && (TIPOS_EVENTO as readonly string[]).includes(valor);
}

export interface EventoProposta {
  id: string;
  tipo: TipoEvento;
  /** null = rotina automática ou pessoa removida */
  porNome: string | null;
  /** ISO 8601 */
  em: string;
  nota: string | null;
  protocolo: string | null;
  temComprovante: boolean;
  /** Só nos eventos de resultado */
  resultado: ResultadoApurado | null;
}

/* ---------- comprovante ---------- */

/** Tamanho máximo do arquivo original (o data URL em base64 fica ~4/3 maior e cabe no limite do banco). */
export const TAMANHO_MAXIMO_COMPROVANTE = 600 * 1024;
/** Limite do data URL inteiro (igual ao check da migration 017). */
export const TAMANHO_MAXIMO_DATA_URL = 850_000;
export const TAMANHO_MAXIMO_PROTOCOLO = 120;
export const TAMANHO_MAXIMO_NOTA_EVENTO = 1000;

const PREFIXO_COMPROVANTE = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/;

export type TipoComprovante = "imagem" | "pdf";

export type ComprovanteLido =
  | { ok: true; mime: string; tipo: TipoComprovante; base64: string }
  | { ok: false; erro: string };

/** Confere formato (PNG, JPEG, WEBP ou PDF em base64) e tamanho. */
export function lerComprovante(dataUrl: string): ComprovanteLido {
  if (dataUrl.length > TAMANHO_MAXIMO_DATA_URL) {
    return { ok: false, erro: "O comprovante passou de 600 KB. Mande um print ou um PDF menor." };
  }
  const m = PREFIXO_COMPROVANTE.exec(dataUrl);
  if (!m) return { ok: false, erro: "O comprovante precisa ser imagem (PNG, JPG) ou PDF." };
  const mime = m[1];
  return { ok: true, mime, tipo: mime === "application/pdf" ? "pdf" : "imagem", base64: m[2] };
}

/* ---------- envio ---------- */

export interface EntradaEnvio {
  protocolo?: string | null;
  comprovante?: string | null;
  nota?: string | null;
}

export interface EnvioValidado {
  protocolo: string | null;
  comprovante: string | null;
  nota: string | null;
}

export type ResultadoValidacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

function textoOuNulo(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

/** Marcar como enviada exige prova: o número do protocolo no portal, o comprovante, ou os dois. */
export function validarEnvio(entrada: EntradaEnvio): ResultadoValidacao<EnvioValidado> {
  const protocolo = textoOuNulo(entrada.protocolo);
  const nota = textoOuNulo(entrada.nota);
  const comprovante = (entrada.comprovante ?? "").trim() === "" ? null : (entrada.comprovante ?? "").trim();
  if (protocolo === null && comprovante === null) {
    return { ok: false, erro: "Informe o número do protocolo ou anexe o comprovante do envio." };
  }
  if (protocolo !== null && protocolo.length > TAMANHO_MAXIMO_PROTOCOLO) {
    return { ok: false, erro: "O número do protocolo está longo demais." };
  }
  if (nota !== null && nota.length > TAMANHO_MAXIMO_NOTA_EVENTO) return { ok: false, erro: "A observação está longa demais." };
  if (comprovante !== null) {
    const lido = lerComprovante(comprovante);
    if (!lido.ok) return { ok: false, erro: lido.erro };
  }
  return { ok: true, valor: { protocolo, comprovante, nota } };
}

/* ---------- proposta enviada fora do sistema ---------- */

export interface EntradaExterna extends EntradaEnvio {
  orgao: string;
  /** Número do pregão/dispensa, o número de controle do PNCP ou o link da compra no PNCP */
  numero: string;
  portal: string;
  /** Em reais, como digitado ("62.000,00" ou "62000.5") */
  valor: string;
  /** yyyy-mm-dd; vazio = hoje */
  enviadaEm?: string | null;
  objeto?: string | null;
}

export interface ExternaValidada extends EnvioValidado {
  orgao: string;
  numero: string;
  portal: string;
  objeto: string;
  valorCentavos: number;
  /** yyyy-mm-dd ou null (hoje) */
  enviadaEm: string | null;
  /** numeroControlePNCP quando o número informado é do PNCP: liga a consulta automática do resultado */
  compraId: string | null;
}

/** "62.000,00", "62000,5", "62000.50", "R$ 1.234" em centavos; null se não for um valor. */
export function lerValorEmCentavos(texto: string): number | null {
  let t = texto.replace(/R\$|\s/gi, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const centavos = Math.round(Number(t) * 100);
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/**
 * Número de controle do PNCP ("00394502000144-1-015323/2026") a partir do próprio número
 * ou do link da compra ("pncp.gov.br/app/editais/00394502000144/2026/15323"); null se não for do PNCP.
 */
export function numeroControleDoTexto(texto: string): string | null {
  const t = texto.trim();
  const controle = /(\d{14})-(\d+)-(\d{1,9})\/(\d{4})/.exec(t);
  if (controle) return `${controle[1]}-${controle[2]}-${controle[3].padStart(6, "0")}/${controle[4]}`;
  const link = /pncp\.gov\.br\/app\/editais\/(\d{14})\/(\d{4})\/(\d{1,9})/.exec(t);
  if (link) return `${link[1]}-1-${link[3].padStart(6, "0")}/${link[2]}`;
  return null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Confere os campos; `hoje` (yyyy-mm-dd) impede data de envio no futuro. */
export function validarExterna(entrada: EntradaExterna, hoje: string): ResultadoValidacao<ExternaValidada> {
  const orgao = textoOuNulo(entrada.orgao);
  const numero = textoOuNulo(entrada.numero);
  const portal = textoOuNulo(entrada.portal);
  if (orgao === null) return { ok: false, erro: "Informe o órgão." };
  if (numero === null) return { ok: false, erro: "Informe o número da licitação." };
  if (portal === null) return { ok: false, erro: "Informe o portal onde a proposta foi enviada." };
  if (orgao.length > 200 || numero.length > 200 || portal.length > 80) return { ok: false, erro: "Há um campo longo demais." };
  const objeto = textoOuNulo(entrada.objeto) ?? "";
  if (objeto.length > 500) return { ok: false, erro: "O objeto está longo demais." };

  const valorCentavos = lerValorEmCentavos(entrada.valor);
  if (valorCentavos === null || valorCentavos <= 0) return { ok: false, erro: "Informe o valor da proposta." };

  const data = textoOuNulo(entrada.enviadaEm);
  if (data !== null && (!DATA_ISO.test(data) || Number.isNaN(Date.parse(data)))) {
    return { ok: false, erro: "A data do envio está inválida." };
  }
  if (data !== null && data > hoje) return { ok: false, erro: "A data do envio não pode ser no futuro." };

  const envio = validarEnvio(entrada);
  if (!envio.ok) return envio;
  return {
    ok: true,
    valor: { ...envio.valor, orgao, numero, portal, objeto, valorCentavos, enviadaEm: data, compraId: numeroControleDoTexto(numero) },
  };
}

/* ---------- linha do tempo ---------- */

export interface BaseLinhaDoTempo {
  /** ISO 8601 */
  criadoEm: string;
  criadoPorNome: string | null;
  autor: "usuario" | "assistente";
}

/**
 * Eventos em ordem de data (mais antigo primeiro). Propostas criadas antes da linha do tempo não têm o evento
 * "criada": ele entra a partir da data de criação da proposta.
 */
export function linhaDoTempo(eventos: ReadonlyArray<EventoProposta>, base: BaseLinhaDoTempo): EventoProposta[] {
  const lista = [...eventos];
  if (!lista.some((e) => e.tipo === "criada")) {
    lista.push({
      id: "criada",
      tipo: "criada",
      porNome: base.autor === "assistente" ? "Assistente" : base.criadoPorNome,
      em: base.criadoEm,
      nota: null,
      protocolo: null,
      temComprovante: false,
      resultado: null,
    });
  }
  return lista.sort((a, b) => Date.parse(a.em) - Date.parse(b.em) || TIPOS_EVENTO.indexOf(a.tipo) - TIPOS_EVENTO.indexOf(b.tipo));
}
