import { normalizarTexto } from "./cnae-keywords";
import { IBGE_CAPITAL, IBGE_NOVA_IGUACU, MUNICIPIOS_BAIXADA } from "./regioes";
import { acharUf, ufDoCodigoIbge } from "./ufs";
import type { Oportunidade, Regiao } from "./types";

/**
 * Onde a empresa atende. Modelo puro, sem acesso a banco ou rede.
 * - `ufs`: estados inteiros.
 * - `municipiosIbge`: municípios avulsos (inclui o que o atalho "capital + região metropolitana" marca).
 * - `base`: de onde a empresa opera; a nota de local mede a distância a partir dele.
 */
export interface BaseAreas {
  uf: string;
  /** Código IBGE de 7 dígitos; null quando a empresa ainda não escolheu o município-base */
  municipioIbge: string | null;
}

export interface Areas {
  ufs: string[];
  municipiosIbge: string[];
  base: BaseAreas;
}

export const AREAS_VAZIAS: Areas = { ufs: [], municipiosIbge: [], base: { uf: "", municipioIbge: null } };

export interface RegiaoMetropolitana {
  id: string;
  nome: string;
  uf: string;
  /** Código IBGE da capital, que também consta em `municipios` */
  capitalIbge: string;
  /** Código IBGE -> nome, capital incluída. Códigos conferidos em servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios */
  municipios: Readonly<Record<string, string>>;
}

const RM_RIO: RegiaoMetropolitana = {
  id: "rm-rio",
  nome: "Região Metropolitana do Rio de Janeiro",
  uf: "RJ",
  capitalIbge: IBGE_CAPITAL,
  municipios: {
    "3300456": "Belford Roxo",
    "3300803": "Cachoeiras de Macacu",
    "3301702": "Duque de Caxias",
    "3301850": "Guapimirim",
    "3301900": "Itaboraí",
    "3302007": "Itaguaí",
    "3302270": "Japeri",
    "3302502": "Magé",
    "3302700": "Maricá",
    "3302858": "Mesquita",
    "3303203": "Nilópolis",
    "3303302": "Niterói",
    "3303500": "Nova Iguaçu",
    "3303609": "Paracambi",
    "3304144": "Queimados",
    "3304557": "Rio de Janeiro",
    "3304904": "São Gonçalo",
    "3305109": "São João de Meriti",
    "3305554": "Seropédica",
    "3305752": "Tanguá",
  },
};

const RM_BH: RegiaoMetropolitana = {
  id: "rm-bh",
  nome: "Região Metropolitana de Belo Horizonte",
  uf: "MG",
  capitalIbge: "3106200",
  municipios: {
    "3105004": "Baldim",
    "3106200": "Belo Horizonte",
    "3106705": "Betim",
    "3109006": "Brumadinho",
    "3110004": "Caeté",
    "3112505": "Capim Branco",
    "3117876": "Confins",
    "3118601": "Contagem",
    "3124104": "Esmeraldas",
    "3126000": "Florestal",
    "3129806": "Ibirité",
    "3130101": "Igarapé",
    "3132206": "Itaguara",
    "3133709": "Itatiaiuçu",
    "3134608": "Jaboticatubas",
    "3136652": "Juatuba",
    "3137601": "Lagoa Santa",
    "3140159": "Mário Campos",
    "3140704": "Mateus Leme",
    "3141108": "Matozinhos",
    "3144805": "Nova Lima",
    "3136603": "Nova União",
    "3149309": "Pedro Leopoldo",
    "3153905": "Raposos",
    "3154606": "Ribeirão das Neves",
    "3154804": "Rio Acima",
    "3155306": "Rio Manso",
    "3156700": "Sabará",
    "3157807": "Santa Luzia",
    "3162922": "São Joaquim de Bicas",
    "3162955": "São José da Lapa",
    "3165537": "Sarzedo",
    "3168309": "Taquaraçu de Minas",
    "3171204": "Vespasiano",
  },
};

const RM_VITORIA: RegiaoMetropolitana = {
  id: "rm-vitoria",
  nome: "Grande Vitória",
  uf: "ES",
  capitalIbge: "3205309",
  municipios: {
    "3201308": "Cariacica",
    "3202207": "Fundão",
    "3202405": "Guarapari",
    "3205002": "Serra",
    "3205101": "Viana",
    "3205200": "Vila Velha",
    "3205309": "Vitória",
  },
};

/** Regiões metropolitanas que a tela oferece como atalho: Rio, Belo Horizonte e Grande Vitória. */
export const REGIOES_METROPOLITANAS: ReadonlyArray<RegiaoMetropolitana> = [RM_RIO, RM_BH, RM_VITORIA];

/** UFs com atalho "Capital + região metropolitana". */
export const UFS_COM_ATALHO: ReadonlyArray<string> = REGIOES_METROPOLITANAS.map((r) => r.uf);

export function regiaoMetropolitanaDaUf(uf: string): RegiaoMetropolitana | undefined {
  const sigla = uf.trim().toUpperCase();
  return REGIOES_METROPOLITANAS.find((r) => r.uf === sigla);
}

export function rmDoMunicipio(codigoIbge: string): RegiaoMetropolitana | undefined {
  const codigo = codigoIbge.trim();
  return REGIOES_METROPOLITANAS.find((r) => codigo in r.municipios);
}

export function ehCapital(codigoIbge: string): boolean {
  const codigo = codigoIbge.trim();
  return REGIOES_METROPOLITANAS.some((r) => r.capitalIbge === codigo);
}

/** Códigos IBGE da capital e de toda a região metropolitana da UF; vazio para UF sem atalho. */
export function municipiosDoAtalho(uf: string): string[] {
  const rm = regiaoMetropolitanaDaUf(uf);
  return rm ? Object.keys(rm.municipios) : [];
}

/** Nome do município quando ele consta nas regiões metropolitanas conhecidas; undefined nos demais. */
export function nomeDoMunicipioConhecido(codigoIbge: string): string | undefined {
  const rm = rmDoMunicipio(codigoIbge);
  return rm?.municipios[codigoIbge.trim()];
}

/** Código IBGE de um município das regiões metropolitanas conhecidas, pelo nome e pela UF. */
export function acharMunicipioConhecido(uf: string, nome: string): string | null {
  const alvo = normalizarTexto(nome);
  if (alvo === "") return null;
  const rm = regiaoMetropolitanaDaUf(uf);
  if (!rm) return null;
  for (const [codigo, nomeRm] of Object.entries(rm.municipios)) {
    if (normalizarTexto(nomeRm) === alvo) return codigo;
  }
  return null;
}

const FORMATO_IBGE = /^[0-9]{7}$/;

function unicos(lista: string[]): string[] {
  return [...new Set(lista)];
}

/**
 * Valida o que veio do banco ou do formulário: descarta UFs e códigos inválidos, tira repetidos e ordena.
 * Nunca lança; sem nada válido devolve áreas vazias.
 */
export function normalizarAreas(bruto: unknown): Areas {
  if (typeof bruto !== "object" || bruto === null) return { ...AREAS_VAZIAS, ufs: [], municipiosIbge: [] };
  const o = bruto as Record<string, unknown>;
  const ufs = Array.isArray(o.ufs)
    ? unicos(o.ufs.flatMap((u) => (typeof u === "string" && acharUf(u) ? [u.trim().toUpperCase()] : [])))
    : [];
  const municipiosIbge = Array.isArray(o.municipiosIbge)
    ? unicos(o.municipiosIbge.flatMap((m) => (typeof m === "string" && FORMATO_IBGE.test(m.trim()) && ufDoCodigoIbge(m) ? [m.trim()] : [])))
    : [];
  const base = typeof o.base === "object" && o.base !== null ? (o.base as Record<string, unknown>) : {};
  const baseUf = typeof base.uf === "string" && acharUf(base.uf) ? base.uf.trim().toUpperCase() : "";
  const baseMun =
    typeof base.municipioIbge === "string" && FORMATO_IBGE.test(base.municipioIbge.trim()) && ufDoCodigoIbge(base.municipioIbge)
      ? base.municipioIbge.trim()
      : null;
  return {
    ufs: ufs.sort(),
    municipiosIbge: municipiosIbge.sort(),
    // O município-base manda no estado-base: os dois nunca divergem.
    base: { uf: baseMun ? (ufDoCodigoIbge(baseMun)?.sigla ?? baseUf) : baseUf, municipioIbge: baseMun },
  };
}

/** UFs que o cron precisa coletar para estas áreas: as marcadas inteiras mais as dos municípios avulsos. */
export function ufsDeColeta(areas: Areas): string[] {
  const siglas = new Set<string>(areas.ufs);
  for (const m of areas.municipiosIbge) {
    const uf = ufDoCodigoIbge(m);
    if (uf) siglas.add(uf.sigla);
  }
  return [...siglas].sort();
}

/** União das UFs de coleta de várias empresas, sem repetir. */
export function uniaoDeUfs(lista: ReadonlyArray<Areas>): string[] {
  return [...new Set(lista.flatMap((a) => ufsDeColeta(a)))].sort();
}

type LocalDaOportunidade = Pick<Oportunidade, "uf" | "codigoIbge">;

/** A oportunidade está num estado marcado inteiro ou num município avulso marcado. */
export function dentroDasAreas(o: LocalDaOportunidade, areas: Areas): boolean {
  const uf = o.uf.trim().toUpperCase();
  return areas.ufs.includes(uf) || areas.municipiosIbge.includes(o.codigoIbge.trim());
}

/** Do mais perto da base ao mais longe. */
export type NivelLocal = "municipio-base" | "mesma-rm" | "capital-ou-rm" | "mesma-uf" | "outra-uf" | "fora";

/** Pontos do critério de local para serviço presencial (máximo 20); "fora" das áreas não pontua. */
export const PONTOS_LOCAL: Readonly<Record<NivelLocal, number>> = {
  "municipio-base": 20,
  "mesma-rm": 16,
  "capital-ou-rm": 12,
  "mesma-uf": 6,
  "outra-uf": 3,
  fora: 0,
};

export interface LocalPontuado {
  nivel: NivelLocal;
  pontos: number;
  dentro: boolean;
}

/**
 * Quanto mais perto da base, mais nota: mesmo município > mesma região metropolitana >
 * capital ou região metropolitana do estado-base > resto do estado-base > outro estado escolhido.
 * Fora das áreas marcadas, zero.
 */
export function pontuacaoLocal(o: LocalDaOportunidade, areas: Areas): LocalPontuado {
  const resultado = (nivel: NivelLocal): LocalPontuado => ({ nivel, pontos: PONTOS_LOCAL[nivel], dentro: nivel !== "fora" });
  if (!dentroDasAreas(o, areas)) return resultado("fora");

  const codigo = o.codigoIbge.trim();
  const uf = o.uf.trim().toUpperCase();
  const base = areas.base;
  if (base.municipioIbge !== null && codigo === base.municipioIbge) return resultado("municipio-base");

  const rmBase = base.municipioIbge !== null ? rmDoMunicipio(base.municipioIbge) : undefined;
  if (rmBase && codigo in rmBase.municipios) return resultado("mesma-rm");

  if (base.uf !== "" && uf === base.uf) {
    return resultado(ehCapital(codigo) || rmDoMunicipio(codigo) ? "capital-ou-rm" : "mesma-uf");
  }
  return resultado("outra-uf");
}

/**
 * Áreas equivalentes às regiões antigas (perfil.regioes) para empresas que ainda não escolheram.
 * Mesma regra da migration 020: "rj" (interior) vale o estado inteiro; as demais viram municípios.
 */
export function areasDasRegioes(regioes: ReadonlyArray<Regiao>, uf: string, municipio: string): Areas {
  const sigla = uf.trim().toUpperCase();
  const ufs: string[] = [];
  const municipios: string[] = [];
  if (regioes.includes("rj")) {
    ufs.push("RJ");
  } else {
    if (regioes.includes("nova-iguacu")) municipios.push(IBGE_NOVA_IGUACU);
    if (regioes.includes("capital")) municipios.push(IBGE_CAPITAL);
    if (regioes.includes("baixada")) municipios.push(...Object.keys(MUNICIPIOS_BAIXADA));
  }
  if (sigla !== "RJ" && regioes.includes("fora-rj") && acharUf(sigla)) ufs.push(sigla);
  return normalizarAreas({
    ufs,
    municipiosIbge: municipios,
    base: { uf: sigla, municipioIbge: acharMunicipioConhecido(sigla, municipio) },
  });
}

/** Regiões antigas equivalentes às áreas, para o que ainda lê perfil.regioes (conselheiro, painel do admin). */
export function regioesDasAreas(areas: Areas): Regiao[] {
  const regioes: Regiao[] = [];
  if (areas.ufs.includes("RJ")) {
    regioes.push("nova-iguacu", "baixada", "capital", "rj");
  } else {
    if (areas.municipiosIbge.includes(IBGE_NOVA_IGUACU)) regioes.push("nova-iguacu");
    if (areas.municipiosIbge.some((m) => m in MUNICIPIOS_BAIXADA)) regioes.push("baixada");
    if (areas.municipiosIbge.includes(IBGE_CAPITAL)) regioes.push("capital");
  }
  if (ufsDeColeta(areas).some((u) => u !== "RJ")) regioes.push("fora-rj");
  return regioes;
}
