import type { Frente } from "./types";

/** Dados cadastrais da empresa usados no cálculo de elegibilidade e de limite MEI. */
export const EMPRESA = {
  razaoSocial: "70.048.886 ARTHUR SILVA MOURA",
  cnpj: "70.048.886/0001-29",
  /** Data de abertura no formato AAAA-MM-DD */
  dataAbertura: "2026-11-09",
  porte: "MEI",
  municipio: "Nova Iguaçu",
  uf: "RJ",
} as const;

export interface Cnae {
  codigo: string;
  descricao: string;
  /** true apenas para a atividade principal registrada no CNPJ */
  principal: boolean;
}

export const CNAES_SERVICOS = [
  { codigo: "95.11-8-00", descricao: "Manutenção de computadores e periféricos", principal: true },
  { codigo: "43.21-5-00", descricao: "Instalação e manutenção elétrica, segurança eletrônica e CFTV", principal: false },
  { codigo: "61.90-6-99", descricao: "Redes de computadores e telecomunicações", principal: false },
  { codigo: "85.99-6-03", descricao: "Treinamento em informática", principal: false },
  { codigo: "82.19-9-99", descricao: "Apoio administrativo, preparação de documentos e digitação", principal: false },
  { codigo: "58.19-1-00", descricao: "Edição de cadastros e listas", principal: false },
] as const satisfies readonly Cnae[];

export const CNAES_PRODUTOS = [
  { codigo: "47.51-2-01", descricao: "Equipamentos e suprimentos de informática", principal: false },
  { codigo: "47.52-1-00", descricao: "Telefonia e comunicação", principal: false },
  { codigo: "47.42-3-00", descricao: "Material elétrico", principal: false },
  { codigo: "47.53-9-00", descricao: "Eletrodomésticos e áudio/vídeo", principal: false },
  { codigo: "47.89-0-07", descricao: "Equipamentos para escritório", principal: false },
  { codigo: "47.44-0-01", descricao: "Ferragens e ferramentas", principal: false },
  { codigo: "47.57-1-00", descricao: "Peças para aparelhos eletroeletrônicos", principal: false },
  { codigo: "47.41-5-00", descricao: "Tintas e materiais para pintura", principal: false },
  { codigo: "47.89-0-05", descricao: "Saneantes e produtos de limpeza", principal: false },
  { codigo: "47.89-0-99", descricao: "Outros produtos e embalagens", principal: false },
] as const satisfies readonly Cnae[];

export type CodigoCnaeServicos = (typeof CNAES_SERVICOS)[number]["codigo"];
export type CodigoCnaeProdutos = (typeof CNAES_PRODUTOS)[number]["codigo"];
export type CodigoCnae = CodigoCnaeServicos | CodigoCnaeProdutos;

export const CNAES_POR_FRENTE: Record<Frente, readonly Cnae[]> = {
  servicos: CNAES_SERVICOS,
  produtos: CNAES_PRODUTOS,
};

export const TODOS_CNAES: readonly Cnae[] = [...CNAES_SERVICOS, ...CNAES_PRODUTOS];

/** Frente à qual o CNAE pertence; undefined se o código não é da empresa. */
export function frenteDoCnae(codigo: string): Frente | undefined {
  if (CNAES_SERVICOS.some((c) => c.codigo === codigo)) return "servicos";
  if (CNAES_PRODUTOS.some((c) => c.codigo === codigo)) return "produtos";
  return undefined;
}

export function descricaoDoCnae(codigo: string): string | undefined {
  return TODOS_CNAES.find((c) => c.codigo === codigo)?.descricao;
}
