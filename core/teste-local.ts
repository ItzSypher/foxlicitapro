import type { Oportunidade, Regiao } from "./types";

/** Só para testes: município e UF reais que correspondem a cada região antiga, vistos a partir de Nova Iguaçu. */
export const LOCAL_DA_REGIAO: Readonly<Record<Regiao, Pick<Oportunidade, "codigoIbge" | "uf" | "municipio">>> = {
  "nova-iguacu": { codigoIbge: "3303500", uf: "RJ", municipio: "Nova Iguaçu" },
  baixada: { codigoIbge: "3301702", uf: "RJ", municipio: "Duque de Caxias" },
  capital: { codigoIbge: "3304557", uf: "RJ", municipio: "Rio de Janeiro" },
  rj: { codigoIbge: "3303906", uf: "RJ", municipio: "Petrópolis" },
  "fora-rj": { codigoIbge: "3550308", uf: "SP", municipio: "São Paulo" },
};
