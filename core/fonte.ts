/** Portais de origem que o Radar reconhece pelo link da contratação. */
export type Fonte = "Compras.gov" | "BNC" | "BLL" | "Licitanet" | "Portal de Compras Públicas" | "Compras RJ" | "Outro portal";

export const FONTES: ReadonlyArray<Fonte> = [
  "Compras.gov",
  "BNC",
  "BLL",
  "Licitanet",
  "Portal de Compras Públicas",
  "Compras RJ",
  "Outro portal",
];

/** Trechos do domínio, em minúsculas, na ordem em que valem. */
const REGRAS: ReadonlyArray<{ fonte: Fonte; trechos: ReadonlyArray<string> }> = [
  { fonte: "Compras.gov", trechos: ["comprasnet", "compras.gov", "estaleiro.serpro.gov.br", "cnetmobile"] },
  { fonte: "BNC", trechos: ["bnccompras"] },
  { fonte: "BLL", trechos: ["bllcompras"] },
  { fonte: "Licitanet", trechos: ["licitanet"] },
  { fonte: "Portal de Compras Públicas", trechos: ["portaldecompraspublicas"] },
  { fonte: "Compras RJ", trechos: ["compras.rj.gov.br"] },
];

function hospedeDe(link: string): string {
  const texto = link.trim().toLowerCase();
  try {
    return new URL(texto.includes("://") ? texto : `https://${texto}`).hostname;
  } catch {
    return texto;
  }
}

/** Portal de origem da oportunidade, pelo `linkOrigem` do PNCP. Sem link ou domínio desconhecido: "Outro portal". */
export function fonteDaOportunidade(link: string | null | undefined): Fonte {
  if (!link || link.trim() === "") return "Outro portal";
  const hospede = hospedeDe(link);
  for (const regra of REGRAS) {
    if (regra.trechos.some((t) => hospede.includes(t))) return regra.fonte;
  }
  return "Outro portal";
}
