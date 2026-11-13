import "server-only";
import { z } from "zod";

/**
 * Cliente mínimo da API REST do Gemini (sem biblioteca): POST /v1beta/models/{modelo}:generateContent,
 * chave no cabeçalho x-goog-api-key, saída estruturada por generationConfig.responseMimeType
 * + responseJsonSchema e PDF inline em inlineData (application/pdf, base64).
 * Documentação: https://ai.google.dev/api/generate-content e https://ai.google.dev/gemini-api/docs/models
 * Nunca registra a chave nem o conteúdo enviado ou recebido.
 */

const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Flash estável vigente na página de modelos; troque por GEMINI_MODEL sem mexer no código. */
export const MODELO_PADRAO = "gemini-3.8-flash";
const TIMEOUT_MS = 60_000;
const ESPERA_RETRY_MS = 1500;
const STATUS_COM_RETRY: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);
const MAX_ERROS_NA_CORRECAO = 8;

export type CodigoErroAssistente =
  | "sem-chave"
  | "chave-invalida"
  | "modelo-indisponivel"
  | "limite"
  | "indisponivel"
  | "tempo-esgotado"
  | "rede"
  | "pedido-invalido"
  | "bloqueado"
  | "resposta-incompleta"
  | "resposta-invalida";

export class ErroAssistente extends Error {
  readonly codigo: CodigoErroAssistente;
  readonly status: number | null;

  constructor(codigo: CodigoErroAssistente, mensagem: string, status: number | null = null) {
    super(mensagem);
    this.name = "ErroAssistente";
    this.codigo = codigo;
    this.status = status;
  }
}

/** Há chave configurada? Sem ela, nenhuma parte do assistente aparece. */
export function assistenteDisponivel(): boolean {
  return chaveConfigurada() !== "";
}

/** Chave sem espaços nem aspas coladas por engano. */
function chaveConfigurada(): string {
  return (process.env.GEMINI_API_KEY ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export function nomeDoModelo(): string {
  const configurado = (process.env.GEMINI_MODEL ?? "").trim();
  return /^[A-Za-z0-9._-]+$/.test(configurado) ? configurado : MODELO_PADRAO;
}

export type ParteEntrada = { tipo: "texto"; texto: string } | { tipo: "pdf"; base64: string };

export interface MensagemHistorico {
  papel: "usuario" | "assistente";
  texto: string;
}

export type EsquemaJson = { [chave: string]: unknown };

export type ParteApi = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface ConteudoApi {
  role: "user" | "model";
  parts: ParteApi[];
}

export interface PedidoApi {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: ConteudoApi[];
  generationConfig: {
    maxOutputTokens: number;
    responseMimeType?: "application/json";
    responseJsonSchema?: EsquemaJson;
  };
}

export interface OpcoesGemini {
  /** Troca o fetch nos testes */
  fetchImpl?: typeof fetch;
  /** Espera antes da nova tentativa em 429/5xx; 0 nos testes */
  esperaRetryMs?: number;
}

function paraParteApi(parte: ParteEntrada): ParteApi {
  if (parte.tipo === "texto") return { text: parte.texto };
  return { inlineData: { mimeType: "application/pdf", data: parte.base64 } };
}

/** Corpo do pedido. A chave não entra aqui: vai só no cabeçalho. */
export function montarPedido(p: {
  sistema: string;
  conteudos: ConteudoApi[];
  maxTokens: number;
  esquemaJson?: EsquemaJson;
}): PedidoApi {
  const generationConfig: PedidoApi["generationConfig"] = { maxOutputTokens: p.maxTokens };
  if (p.esquemaJson) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = p.esquemaJson;
  }
  return {
    systemInstruction: { parts: [{ text: p.sistema }] },
    contents: p.conteudos,
    generationConfig,
  };
}

export function urlDoModelo(modelo: string): string {
  return `${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`;
}

const RespostaSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

/** Texto da primeira resposta (sem os resumos de raciocínio) e o motivo de parada. */
export function lerRespostaApi(corpo: unknown): { texto: string; finishReason: string | null } {
  const lida = RespostaSchema.safeParse(corpo);
  if (!lida.success) throw new ErroAssistente("resposta-invalida", "O assistente devolveu uma resposta fora do formato.");
  const candidato = lida.data.candidates?.[0];
  if (!candidato || lida.data.promptFeedback?.blockReason) {
    throw new ErroAssistente("bloqueado", "O assistente não conseguiu responder a este conteúdo. Reformule e tente de novo.");
  }
  const texto = (candidato.content?.parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? "")
    .join("");
  const finishReason = candidato.finishReason ?? null;
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT" || finishReason === "BLOCKLIST") {
    throw new ErroAssistente("bloqueado", "O assistente não conseguiu responder a este conteúdo. Reformule e tente de novo.");
  }
  return { texto, finishReason };
}

/** Lê o motivo devolvido pela API (só o texto do erro, nunca o conteúdo enviado). */
export function motivoDoErro(corpo: unknown): string {
  if (typeof corpo !== "object" || corpo === null) return "";
  const erro = (corpo as { error?: { message?: unknown; status?: unknown } }).error;
  const partes = [erro?.status, erro?.message].filter((v): v is string => typeof v === "string");
  return partes.join(": ").slice(0, 300);
}

export function erroDoStatus(status: number, motivo = ""): ErroAssistente {
  if (/credit|billing|prepay/i.test(motivo)) {
    return new ErroAssistente(
      "indisponivel",
      "Os créditos do assistente acabaram. Recarregue em AI Studio, na área de Billing do projeto, e tente de novo.",
      status,
    );
  }
  if (/api[ _]?key/i.test(motivo)) {
    return new ErroAssistente(
      "chave-invalida",
      "A chave do assistente foi recusada. Confira o valor de GEMINI_API_KEY na Vercel (sem aspas nem espaços) e faça um novo deploy.",
      status,
    );
  }
  if (status === 404 || /model/i.test(motivo)) {
    return new ErroAssistente(
      "modelo-indisponivel",
      `O modelo configurado não está disponível para esta chave (${nomeDoModelo()}). Ajuste GEMINI_MODEL na Vercel.`,
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new ErroAssistente("chave-invalida", "O assistente não está autorizado. Avise quem cuida do painel.", status);
  }
  if (status === 429) {
    return new ErroAssistente("limite", "O assistente recebeu pedidos demais agora. Espere um pouco e tente de novo.", status);
  }
  if (status >= 500) {
    return new ErroAssistente("indisponivel", "O assistente está fora do ar agora. Tente de novo em instantes.", status);
  }
  const detalhe = motivo === "" ? `código ${status}` : motivo;
  return new ErroAssistente("pedido-invalido", `O assistente não aceitou este pedido (${detalhe}).`, status);
}

function ehTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Uma chamada ao generateContent, com timeout de 60 s e 1 nova tentativa em 429, 5xx ou falha de rede. */
async function chamar(pedido: PedidoApi, opcoes: OpcoesGemini): Promise<{ texto: string; finishReason: string | null }> {
  const chave = chaveConfigurada();
  if (chave === "") throw new ErroAssistente("sem-chave", "O assistente ainda não está ativado.");
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const espera = opcoes.esperaRetryMs ?? ESPERA_RETRY_MS;
  const url = urlDoModelo(nomeDoModelo());
  const corpo = JSON.stringify(pedido);

  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= 1;
    let resposta: Response;
    try {
      resposta = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      if (ehTimeout(e)) {
        throw new ErroAssistente("tempo-esgotado", "O assistente demorou demais para responder. Tente de novo.");
      }
      if (!ultima) {
        await esperar(espera);
        continue;
      }
      throw new ErroAssistente("rede", "Não foi possível falar com o assistente agora. Verifique a conexão e tente de novo.");
    }

    if (STATUS_COM_RETRY.has(resposta.status) && !ultima) {
      await esperar(espera);
      continue;
    }
    if (!resposta.ok) {
      const motivo = motivoDoErro(await resposta.json().catch(() => null));
      console.error("[assistente] falha na API:", resposta.status, motivo);
      throw erroDoStatus(resposta.status, motivo);
    }
    let json: unknown;
    try {
      json = await resposta.json();
    } catch {
      throw new ErroAssistente("resposta-invalida", "O assistente devolveu uma resposta ilegível. Tente de novo.");
    }
    return lerRespostaApi(json);
  }
}

function descreverErros(erro: z.ZodError): string[] {
  return erro.issues.slice(0, MAX_ERROS_NA_CORRECAO).map((i) => {
    const caminho = i.path.map(String).join(".");
    return caminho === "" ? i.message : `${caminho}: ${i.message}`;
  });
}

function validarTexto<T>(texto: string, esquema: z.ZodType<T>): { ok: true; valor: T } | { ok: false; erros: string[] } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, erros: ["O texto devolvido não é um JSON válido."] };
  }
  const lido = esquema.safeParse(bruto);
  return lido.success ? { ok: true, valor: lido.data } : { ok: false, erros: descreverErros(lido.error) };
}

export interface PedidoJson<T> {
  sistema: string;
  partes: ParteEntrada[];
  esquema: z.ZodType<T>;
  esquemaJson: EsquemaJson;
  maxTokens: number;
}

/**
 * Resposta estruturada validada por zod. Se a validação falhar, faz 1 nova tentativa
 * mostrando os erros ao modelo; falhando de novo, lança ErroAssistente("resposta-invalida").
 */
export async function gerarJson<T>(pedido: PedidoJson<T>, opcoes: OpcoesGemini = {}): Promise<T> {
  const conteudos: ConteudoApi[] = [{ role: "user", parts: pedido.partes.map(paraParteApi) }];
  for (let tentativa = 0; ; tentativa += 1) {
    const resposta = await chamar(
      montarPedido({
        sistema: pedido.sistema,
        conteudos,
        maxTokens: pedido.maxTokens,
        esquemaJson: pedido.esquemaJson,
      }),
      opcoes,
    );
    const validado = validarTexto(resposta.texto, pedido.esquema);
    if (validado.ok) return validado.valor;

    if (tentativa >= 1) {
      console.error("[assistente] resposta fora do esquema após nova tentativa:", validado.erros.length, "erro(s)");
      throw new ErroAssistente(
        resposta.finishReason === "MAX_TOKENS" ? "resposta-incompleta" : "resposta-invalida",
        "Não consegui montar uma análise confiável desta licitação. Tente de novo.",
      );
    }
    conteudos.push(
      { role: "model", parts: [{ text: resposta.texto.slice(0, 30_000) }] },
      {
        role: "user",
        parts: [
          {
            text: `A resposta anterior não passou na validação:\n- ${validado.erros.join("\n- ")}\nCorrija e devolva somente o JSON completo, no formato pedido.`,
          },
        ],
      },
    );
  }
}

export interface PedidoTexto {
  sistema: string;
  /** Termina sempre com uma mensagem do usuário */
  historico: MensagemHistorico[];
  maxTokens: number;
}

/** Resposta em texto livre para o chat. */
export async function gerarTexto(pedido: PedidoTexto, opcoes: OpcoesGemini = {}): Promise<string> {
  const conteudos: ConteudoApi[] = pedido.historico.map((m) => ({
    role: m.papel === "usuario" ? "user" : "model",
    parts: [{ text: m.texto }],
  }));
  const resposta = await chamar(montarPedido({ sistema: pedido.sistema, conteudos, maxTokens: pedido.maxTokens }), opcoes);
  const texto = resposta.texto.trim();
  if (texto === "") {
    throw new ErroAssistente("resposta-invalida", "O assistente não devolveu resposta. Tente de novo.");
  }
  return texto;
}
