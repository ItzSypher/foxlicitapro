import { z } from "zod";
import { acharUf } from "@/core/ufs";

const URL_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
const TIMEOUT_MS = 6000;
/** A lista de municípios quase não muda: um dia de cache do fetch do Next. */
const REVALIDAR_SEGUNDOS = 24 * 60 * 60;

export interface MunicipioIbge {
  /** Código IBGE de 7 dígitos */
  codigo: string;
  nome: string;
}

const municipioSchema = z.object({ id: z.number().int(), nome: z.string().min(1) });
const listaSchema = z.array(z.unknown());

/** Lê a resposta do IBGE descartando itens fora do padrão, em ordem alfabética. Função pura. */
export function lerMunicipiosIbge(corpo: unknown): MunicipioIbge[] {
  const lista = listaSchema.safeParse(corpo);
  if (!lista.success) return [];
  const municipios: MunicipioIbge[] = [];
  for (const bruto of lista.data) {
    const item = municipioSchema.safeParse(bruto);
    if (item.success) municipios.push({ codigo: String(item.data.id), nome: item.data.nome });
  }
  return municipios.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Municípios de uma UF, direto do IBGE. Devolve null quando a UF não existe ou o IBGE não responde;
 * quem chama decide o que mostrar (a busca também funciona sem município).
 */
export async function listarMunicipios(uf: string, fetchImpl: typeof fetch = fetch): Promise<MunicipioIbge[] | null> {
  const estado = acharUf(uf);
  if (!estado) return null;
  try {
    const resposta = await fetchImpl(`${URL_BASE}/${estado.sigla}/municipios`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDAR_SEGUNDOS },
    });
    if (!resposta.ok) return null;
    const municipios = lerMunicipiosIbge(await resposta.json());
    return municipios.length > 0 ? municipios : null;
  } catch {
    return null;
  }
}
