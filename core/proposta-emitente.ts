import { EMPRESA } from "./empresa";

/** Dados de quem emite a proposta. Razão social e CNPJ vêm do cadastro da empresa. */
export const EMITENTE = {
  razaoSocial: EMPRESA.razaoSocial,
  cnpj: EMPRESA.cnpj,
  porte: EMPRESA.porte,
  endereco: "Rua João Batista Rodrigues, 70, Casa, Da Luz",
  cidade: EMPRESA.municipio,
  uf: EMPRESA.uf,
  cep: "26260-340",
  telefone: "(21) 9942-9781",
  email: "arthurfoxinfo@gmail.com",
  responsavel: "Arthur Silva Moura",
} as const;

/** "Rua João Batista Rodrigues, 70, Casa, Da Luz, Nova Iguaçu - RJ, CEP 26260-340" */
export function enderecoCompleto(): string {
  return `${EMITENTE.endereco}, ${EMITENTE.cidade} - ${EMITENTE.uf}, CEP ${EMITENTE.cep}`;
}
