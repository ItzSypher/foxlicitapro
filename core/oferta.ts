import { normalizarTexto, regexDoTermo } from "./cnae-keywords";

/** Grupos em que os termos do foco aparecem como selos no Radar. */
export type GrupoOferta = "Sites" | "Sistemas" | "Informática" | "Escritório" | "Outros";

export interface SeloOferta {
  grupo: GrupoOferta;
  termos: string[];
}

const REGRAS: ReadonlyArray<{ grupo: GrupoOferta; regex: RegExp }> = [
  { grupo: "Sites", regex: regexDoTermo("site") },
  { grupo: "Sites", regex: regexDoTermo("redesign") },
  { grupo: "Sites", regex: regexDoTermo("landing page") },
  { grupo: "Sites", regex: regexDoTermo("loja virtual") },
  { grupo: "Sites", regex: regexDoTermo("hospedagem") },
  { grupo: "Sistemas", regex: regexDoTermo("sistema") },
  { grupo: "Sistemas", regex: regexDoTermo("software") },
  { grupo: "Sistemas", regex: regexDoTermo("aplicativo") },
  { grupo: "Sistemas", regex: regexDoTermo("saas") },
  { grupo: "Sistemas", regex: regexDoTermo("desenvolvimento") },
  { grupo: "Escritório", regex: regexDoTermo("escritorio") },
  { grupo: "Escritório", regex: regexDoTermo("papelaria") },
  { grupo: "Escritório", regex: regexDoTermo("expediente") },
  { grupo: "Informática", regex: regexDoTermo("informatica") },
  { grupo: "Informática", regex: regexDoTermo("computador") },
  { grupo: "Informática", regex: regexDoTermo("notebook") },
  { grupo: "Informática", regex: regexDoTermo("impressora") },
  { grupo: "Informática", regex: regexDoTermo("toner") },
  { grupo: "Informática", regex: regexDoTermo("rede") },
];

const ORDEM: ReadonlyArray<GrupoOferta> = ["Sites", "Sistemas", "Informática", "Escritório", "Outros"];

function grupoDoTermo(termo: string): GrupoOferta {
  const texto = normalizarTexto(termo);
  return REGRAS.find((r) => r.regex.test(texto))?.grupo ?? "Outros";
}

/** Agrupa os termos do foco da empresa em selos curtos, numa ordem fixa. Função pura. */
export function agruparOferta(foco: ReadonlyArray<string>): SeloOferta[] {
  const porGrupo = new Map<GrupoOferta, string[]>();
  for (const termo of foco) {
    const grupo = grupoDoTermo(termo);
    porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), termo]);
  }
  return ORDEM.flatMap((grupo) => {
    const termos = porGrupo.get(grupo);
    return termos ? [{ grupo, termos }] : [];
  });
}
