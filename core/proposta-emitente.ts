import { formatarCnpj } from "./brasilapi";
import { ROTULO_PORTE, type PerfilEmpresa } from "./perfil";

/** Dados de quem emite a proposta (cabeçalho e assinatura). Vêm do perfil da empresa; o que falta fica vazio. */
export interface Emitente {
  razaoSocial: string;
  cnpj: string;
  porte: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  responsavel: string;
}

export function emitenteDoPerfil(perfil: PerfilEmpresa): Emitente {
  return {
    razaoSocial: perfil.razaoSocial,
    cnpj: formatarCnpj(perfil.cnpj),
    porte: ROTULO_PORTE[perfil.porte],
    endereco: perfil.endereco ?? "",
    cidade: perfil.municipio,
    uf: perfil.uf,
    cep: perfil.cep ?? "",
    telefone: perfil.telefone ?? "",
    email: perfil.email ?? "",
    responsavel: perfil.responsavel ?? "",
  };
}

/** "Rua X, 70, Nova Iguaçu - RJ, CEP 26260-340"; partes que faltam são omitidas. */
export function enderecoCompleto(e: Emitente): string {
  const cidade = [e.cidade, e.uf].filter((p) => p !== "").join(" - ");
  return [e.endereco, cidade, e.cep !== "" ? `CEP ${e.cep}` : ""].filter((p) => p !== "").join(", ");
}
