import type { Regiao } from "./types";

/** Códigos IBGE conferidos em servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios */
export const IBGE_NOVA_IGUACU = "3303500";
export const IBGE_CAPITAL = "3304557";

/** Municípios da Baixada Fluminense (exceto Nova Iguaçu), por código IBGE. */
export const MUNICIPIOS_BAIXADA: Readonly<Record<string, string>> = {
  "3301702": "Duque de Caxias",
  "3305109": "São João de Meriti",
  "3300456": "Belford Roxo",
  "3303203": "Nilópolis",
  "3302858": "Mesquita",
  "3304144": "Queimados",
  "3302270": "Japeri",
  "3302502": "Magé",
  "3301850": "Guapimirim",
  "3305554": "Seropédica",
  "3302007": "Itaguaí",
  "3303609": "Paracambi",
};

/** Classifica o município de uma contratação em relação a Nova Iguaçu. */
export function regiaoDe(codigoIbge: string | number, uf: string): Regiao {
  if (uf.trim().toUpperCase() !== "RJ") return "fora-rj";
  const codigo = String(codigoIbge).trim();
  if (codigo === IBGE_NOVA_IGUACU) return "nova-iguacu";
  if (codigo === IBGE_CAPITAL) return "capital";
  if (codigo in MUNICIPIOS_BAIXADA) return "baixada";
  return "rj";
}
