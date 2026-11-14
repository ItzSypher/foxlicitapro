import "server-only";

/**
 * WhatsApp pela Evolution API. Só ativa com as três variáveis (EVOLUTION_API_URL, EVOLUTION_INSTANCE e
 * EVOLUTION_API_KEY); sem elas, não envia e não quebra nada. HTTP só com fetch.
 */

export interface ConfigEvolution {
  /** Endereço da API, sem barra no fim */
  url: string;
  instancia: string;
  chave: string;
}

export interface PedidoEvolution {
  url: string;
  init: RequestInit;
}

export interface ResultadoWhatsapp {
  ok: boolean;
  erro?: string;
}

export function configEvolution(env: Readonly<Record<string, string | undefined>> = process.env): ConfigEvolution | null {
  const url = env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const instancia = env.EVOLUTION_INSTANCE?.trim();
  const chave = env.EVOLUTION_API_KEY?.trim();
  if (!url || !instancia || !chave) return null;
  return { url, instancia, chave };
}

export function whatsappConfigurado(): boolean {
  return configEvolution() !== null;
}

/** POST {url}/message/sendText/{instância}, com a chave no cabeçalho `apikey` e corpo { number, text }. */
export function montarPedidoEvolution(config: ConfigEvolution, numero: string, texto: string): PedidoEvolution {
  return {
    url: `${config.url}/message/sendText/${encodeURIComponent(config.instancia)}`,
    init: {
      method: "POST",
      headers: { apikey: config.chave, "Content-Type": "application/json" },
      body: JSON.stringify({ number: numero, text: texto }),
      signal: AbortSignal.timeout(10_000),
    },
  };
}

/** `numero` já normalizado (55DDDNUMERO). Nunca lança: a falha volta no resultado. */
export async function enviarWhatsapp(numero: string, texto: string): Promise<ResultadoWhatsapp> {
  const config = configEvolution();
  if (!config) return { ok: false, erro: "whatsapp não configurado" };
  if (numero === "") return { ok: false, erro: "sem número" };
  const pedido = montarPedidoEvolution(config, numero, texto);
  try {
    const resposta = await fetch(pedido.url, pedido.init);
    if (resposta.ok) return { ok: true };
    return { ok: false, erro: `falha ${resposta.status}` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha ao enviar" };
  }
}
