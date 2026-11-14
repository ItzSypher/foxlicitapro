import type { Frente, Regiao } from "./types";

/** Porte da empresa no CNPJ. Só o MEI tem teto anual de faturamento. */
export type Porte = "mei" | "me" | "epp" | "demais";

export const PORTES: readonly Porte[] = ["mei", "me", "epp", "demais"];

export const ROTULO_PORTE: Record<Porte, string> = {
  mei: "MEI",
  me: "Microempresa (ME)",
  epp: "Empresa de pequeno porte (EPP)",
  demais: "Demais",
};

export const REGIOES: readonly Regiao[] = ["nova-iguacu", "baixada", "capital", "rj", "fora-rj"];

export const ROTULO_REGIAO: Record<Regiao, string> = {
  "nova-iguacu": "Nova Iguaçu",
  baixada: "Baixada Fluminense",
  capital: "Capital do Rio de Janeiro",
  rj: "Interior do estado do Rio",
  "fora-rj": "Fora do estado do Rio",
};

export interface CnaePerfil {
  codigo: string;
  descricao: string;
  frente: Frente;
  /** true apenas para a atividade principal registrada no CNPJ */
  principal: boolean;
}

/** Quem é a empresa logada: base de score, recomendação, margens, teto MEI, propostas e resumo diário. */
export interface PerfilEmpresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  porte: Porte;
  uf: string;
  municipio: string;
  /** AAAA-MM-DD; null quando não se sabe (tratada como empresa com ano cheio) */
  dataAbertura: string | null;
  cnaes: CnaePerfil[];
  /** Regiões em que a empresa atende; serviço fora delas não é recomendado */
  regioes: Regiao[];
  endereco: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
}

export function ehPorte(valor: unknown): valor is Porte {
  return valor === "mei" || valor === "me" || valor === "epp" || valor === "demais";
}

export function ehRegiao(valor: unknown): valor is Regiao {
  return typeof valor === "string" && (REGIOES as readonly string[]).includes(valor);
}

export function ehMei(perfil: Pick<PerfilEmpresa, "porte">): boolean {
  return perfil.porte === "mei";
}

export function cnaesDaFrente(perfil: Pick<PerfilEmpresa, "cnaes">, frente: Frente): CnaePerfil[] {
  return perfil.cnaes.filter((c) => c.frente === frente);
}

/** Frente à qual o CNAE pertence; undefined se o código não é da empresa. */
export function frenteDoCnae(perfil: Pick<PerfilEmpresa, "cnaes">, codigo: string): Frente | undefined {
  return perfil.cnaes.find((c) => c.codigo === codigo)?.frente;
}

export function descricaoDoCnae(perfil: Pick<PerfilEmpresa, "cnaes">, codigo: string): string | undefined {
  return perfil.cnaes.find((c) => c.codigo === codigo)?.descricao;
}

export function cnaePrincipal(perfil: Pick<PerfilEmpresa, "cnaes">): CnaePerfil | undefined {
  return perfil.cnaes.find((c) => c.principal);
}

/** Nome para exibir: fantasia quando houver, senão a razão social. */
export function nomeExibicao(perfil: Pick<PerfilEmpresa, "nomeFantasia" | "razaoSocial">): string {
  return perfil.nomeFantasia?.trim() || perfil.razaoSocial;
}

/** O serviço presencial só vale dentro das regiões de interesse. */
export function atendeRegiao(perfil: Pick<PerfilEmpresa, "regioes">, regiao: Regiao): boolean {
  return perfil.regioes.includes(regiao);
}
