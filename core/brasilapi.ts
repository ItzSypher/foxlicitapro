import { z } from "zod";
import type { CnaePerfil, Porte } from "./perfil";
import type { Frente, Regiao } from "./types";

/** Consulta pública de CNPJ (sem chave). */
const URL_BASE = "https://brasilapi.com.br/api/cnpj/v1/";
export const TEMPO_LIMITE_MS = 10_000;

export class ErroConsultaCnpj extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConsultaCnpj";
  }
}

/** Só os dígitos do CNPJ. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** "70048886000129" vira "70.048.886/0001-29". Valor que não tem 14 dígitos volta como veio. */
export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return valor;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Confere os dois dígitos verificadores. */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string): number => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((acc, c, i) => acc + Number(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(d.slice(0, 12)) === Number(d[12]) && digito(d.slice(0, 13)) === Number(d[13]);
}

/** 9511800 vira "95.11-8-00". */
export function formatarCnae(codigo: number | string): string {
  const d = String(codigo).replace(/\D/g, "").padStart(7, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5, 7)}`;
}

/** Comércio (divisões 45 a 47) é a frente de produtos; o resto é serviço. Sugestão, a pessoa pode trocar. */
export function frenteSugerida(codigo: string): Frente {
  const divisao = Number(somenteDigitos(codigo).slice(0, 2));
  return divisao >= 45 && divisao <= 47 ? "produtos" : "servicos";
}

/** Regiões sugeridas pela UF (as regiões são medidas a partir do Rio de Janeiro). Editável na tela da empresa. */
export function regioesSugeridas(uf: string): Regiao[] {
  return uf.trim().toUpperCase() === "RJ" ? ["nova-iguacu", "baixada", "capital", "rj"] : ["fora-rj"];
}

const textoOpcional = z.string().nullish();

const respostaSchema = z.object({
  cnpj: z.union([z.string(), z.number()]),
  razao_social: z.string().min(1),
  nome_fantasia: textoOpcional,
  uf: textoOpcional,
  municipio: textoOpcional,
  porte: textoOpcional,
  opcao_pelo_mei: z.boolean().nullish(),
  data_inicio_atividade: textoOpcional,
  cnae_fiscal: z.number().nullish(),
  cnae_fiscal_descricao: textoOpcional,
  cnaes_secundarios: z
    .array(z.object({ codigo: z.number().nullish(), descricao: textoOpcional }))
    .nullish(),
  descricao_tipo_de_logradouro: textoOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cep: z.union([z.string(), z.number()]).nullish(),
  ddd_telefone_1: textoOpcional,
  email: textoOpcional,
});

export interface EmpresaConsultada {
  /** Só dígitos */
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  porte: Porte;
  uf: string;
  municipio: string;
  dataAbertura: string | null;
  cnaes: CnaePerfil[];
  endereco: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
}

function limpo(valor: string | null | undefined): string | null {
  const t = valor?.trim();
  return t ? t : null;
}

function iniciais(texto: string): string {
  return texto.toLowerCase().replace(/(^|\s)(\S)/g, (_t, esp: string, letra: string) => esp + letra.toUpperCase());
}

function porteDaResposta(porte: string | null | undefined, mei: boolean | null | undefined): Porte {
  if (mei === true) return "mei";
  const p = (porte ?? "").toUpperCase();
  if (p.includes("MICRO")) return "me";
  if (p.includes("PEQUENO")) return "epp";
  return "demais";
}

/** Converte a resposta da BrasilAPI no que o cadastro da empresa precisa. Lança ErroConsultaCnpj se faltar o essencial. */
export function mapearRespostaBrasilApi(bruta: unknown): EmpresaConsultada {
  const lida = respostaSchema.safeParse(bruta);
  if (!lida.success) throw new ErroConsultaCnpj("A consulta do CNPJ voltou num formato inesperado.");
  const r = lida.data;

  const cnaes: CnaePerfil[] = [];
  const vistos = new Set<string>();
  const adicionar = (codigo: number | null | undefined, descricao: string | null | undefined, principal: boolean): void => {
    if (!codigo) return;
    const formatado = formatarCnae(codigo);
    if (vistos.has(formatado)) return;
    vistos.add(formatado);
    cnaes.push({ codigo: formatado, descricao: limpo(descricao) ?? formatado, frente: frenteSugerida(formatado), principal });
  };
  adicionar(r.cnae_fiscal, r.cnae_fiscal_descricao, true);
  for (const s of r.cnaes_secundarios ?? []) adicionar(s.codigo, s.descricao, false);

  const rua = [limpo(r.descricao_tipo_de_logradouro), limpo(r.logradouro)].filter((x): x is string => x !== null).join(" ");
  const endereco = [rua, limpo(r.numero), limpo(r.complemento), limpo(r.bairro)].filter((x) => x !== null && x !== "").join(", ");
  const cepDigitos = r.cep === null || r.cep === undefined ? "" : somenteDigitos(String(r.cep)).padStart(8, "0");
  const uf = (limpo(r.uf) ?? "").toUpperCase();

  return {
    cnpj: somenteDigitos(String(r.cnpj)).padStart(14, "0"),
    razaoSocial: r.razao_social.trim(),
    nomeFantasia: limpo(r.nome_fantasia) ? iniciais(limpo(r.nome_fantasia) ?? "") : null,
    porte: porteDaResposta(r.porte, r.opcao_pelo_mei),
    uf,
    municipio: iniciais(limpo(r.municipio) ?? ""),
    dataAbertura: /^\d{4}-\d{2}-\d{2}$/.test(r.data_inicio_atividade ?? "") ? (r.data_inicio_atividade ?? null) : null,
    cnaes,
    endereco: endereco || null,
    cep: cepDigitos.length === 8 ? `${cepDigitos.slice(0, 5)}-${cepDigitos.slice(5)}` : null,
    telefone: limpo(r.ddd_telefone_1),
    email: limpo(r.email)?.toLowerCase() ?? null,
  };
}

type Buscar = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;

/** Consulta o CNPJ na BrasilAPI (10 s de limite, sem chave). */
export async function consultarCnpj(cnpj: string, buscar: Buscar = fetch): Promise<EmpresaConsultada> {
  const digitos = somenteDigitos(cnpj);
  if (!cnpjValido(digitos)) throw new ErroConsultaCnpj("CNPJ inválido. Confira os 14 dígitos.");
  let resposta: Response;
  try {
    resposta = await buscar(URL_BASE + digitos, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ErroConsultaCnpj("Não deu para consultar o CNPJ agora (sem resposta em 10 segundos). Tente de novo.");
  }
  if (resposta.status === 404) throw new ErroConsultaCnpj("CNPJ não encontrado na Receita Federal.");
  if (!resposta.ok) throw new ErroConsultaCnpj(`A consulta do CNPJ falhou (código ${resposta.status}). Tente de novo.`);
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new ErroConsultaCnpj("A consulta do CNPJ voltou num formato inesperado.");
  }
  return mapearRespostaBrasilApi(corpo);
}
