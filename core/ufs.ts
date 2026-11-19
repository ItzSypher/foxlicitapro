export interface UfBrasil {
  sigla: string;
  nome: string;
  /** Código IBGE do estado: os 2 primeiros dígitos do código de seus municípios */
  codigo: string;
}

/** As 27 UFs. */
export const UFS: ReadonlyArray<UfBrasil> = [
  { sigla: "AC", nome: "Acre", codigo: "12" },
  { sigla: "AL", nome: "Alagoas", codigo: "27" },
  { sigla: "AP", nome: "Amapá", codigo: "16" },
  { sigla: "AM", nome: "Amazonas", codigo: "13" },
  { sigla: "BA", nome: "Bahia", codigo: "29" },
  { sigla: "CE", nome: "Ceará", codigo: "23" },
  { sigla: "DF", nome: "Distrito Federal", codigo: "53" },
  { sigla: "ES", nome: "Espírito Santo", codigo: "32" },
  { sigla: "GO", nome: "Goiás", codigo: "52" },
  { sigla: "MA", nome: "Maranhão", codigo: "21" },
  { sigla: "MT", nome: "Mato Grosso", codigo: "51" },
  { sigla: "MS", nome: "Mato Grosso do Sul", codigo: "50" },
  { sigla: "MG", nome: "Minas Gerais", codigo: "31" },
  { sigla: "PA", nome: "Pará", codigo: "15" },
  { sigla: "PB", nome: "Paraíba", codigo: "25" },
  { sigla: "PR", nome: "Paraná", codigo: "41" },
  { sigla: "PE", nome: "Pernambuco", codigo: "26" },
  { sigla: "PI", nome: "Piauí", codigo: "22" },
  { sigla: "RJ", nome: "Rio de Janeiro", codigo: "33" },
  { sigla: "RN", nome: "Rio Grande do Norte", codigo: "24" },
  { sigla: "RS", nome: "Rio Grande do Sul", codigo: "43" },
  { sigla: "RO", nome: "Rondônia", codigo: "11" },
  { sigla: "RR", nome: "Roraima", codigo: "14" },
  { sigla: "SC", nome: "Santa Catarina", codigo: "42" },
  { sigla: "SP", nome: "São Paulo", codigo: "35" },
  { sigla: "SE", nome: "Sergipe", codigo: "28" },
  { sigla: "TO", nome: "Tocantins", codigo: "17" },
];

export function acharUf(sigla: string): UfBrasil | null {
  const s = sigla.trim().toUpperCase();
  return UFS.find((u) => u.sigla === s) ?? null;
}

const SUDESTE: ReadonlyArray<string> = ["RJ", "SP", "MG", "ES"];

/**
 * As 27 siglas na ordem do filtro de estado: as UFs que a empresa atende primeiro (em ordem alfabética),
 * depois o Sudeste (RJ, SP, MG, ES) e por fim as demais em ordem alfabética. Siglas inválidas em
 * `atendidas` são ignoradas.
 */
export function ordenarUfsParaFiltro(atendidas: ReadonlyArray<string>): string[] {
  const todas = UFS.map((u) => u.sigla);
  const primeiras = [...new Set(atendidas.map((s) => s.trim().toUpperCase()))].filter((s) => todas.includes(s)).sort();
  const usadas = new Set(primeiras);
  const sudeste = SUDESTE.filter((s) => !usadas.has(s));
  for (const s of sudeste) usadas.add(s);
  const resto = todas.filter((s) => !usadas.has(s)).sort();
  return [...primeiras, ...sudeste, ...resto];
}

/** UF a que um código IBGE de município (7 dígitos) pertence, pelos 2 primeiros dígitos. */
export function ufDoCodigoIbge(codigoIbge: string): UfBrasil | null {
  const prefixo = codigoIbge.trim().slice(0, 2);
  return UFS.find((u) => u.codigo === prefixo) ?? null;
}
