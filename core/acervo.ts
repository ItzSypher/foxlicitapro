/** Acervo da empresa: atestados, notas fiscais, contratos e certidões que provam a qualificação (funções puras, sem banco). */
import { z } from "zod";
import { cnpjValido, somenteDigitos } from "@/core/brasilapi";
import { normalizarTexto, regexDoTermo } from "@/core/cnae-keywords";

export const TIPOS_ACERVO = ["atestado", "nota_fiscal", "contrato", "certidao", "outro"] as const;
export type TipoAcervo = (typeof TIPOS_ACERVO)[number];

export const ROTULO_TIPO_ACERVO: Record<TipoAcervo, string> = {
  atestado: "Atestado de capacidade técnica",
  nota_fiscal: "Nota fiscal",
  contrato: "Contrato",
  certidao: "Certidão",
  outro: "Outro documento",
};

/** Rótulo curto, para chips e filtros. */
export const ROTULO_CURTO_TIPO_ACERVO: Record<TipoAcervo, string> = {
  atestado: "Atestado",
  nota_fiscal: "Nota fiscal",
  contrato: "Contrato",
  certidao: "Certidão",
  outro: "Outro",
};

export function ehTipoAcervo(valor: unknown): valor is TipoAcervo {
  return typeof valor === "string" && (TIPOS_ACERVO as readonly string[]).includes(valor);
}

export interface AreaSugerida {
  valor: string;
  rotulo: string;
  /** Palavras do objeto de uma licitação que remetem a esta área (sem acento, minúsculas) */
  termos: readonly string[];
}

/** Áreas sugeridas no formulário; a pessoa também pode digitar outras. */
export const AREAS_SUGERIDAS: readonly AreaSugerida[] = [
  {
    valor: "site",
    rotulo: "Site institucional",
    termos: ["site", "website", "hotsite", "pagina web", "desenvolvimento web", "hospedagem", "dominio", "portal institucional"],
  },
  {
    valor: "sistemas",
    rotulo: "Sistemas e software",
    termos: ["sistema", "software", "aplicativo", "aplicacao", "plataforma", "licenca de software", "banco de dados", "desenvolvimento de sistemas"],
  },
  {
    valor: "manutencao",
    rotulo: "Manutenção",
    termos: ["manutencao", "conserto", "reparo", "assistencia tecnica", "suporte tecnico", "manutencao preventiva", "manutencao corretiva"],
  },
  {
    valor: "redes",
    rotulo: "Redes e cabeamento",
    termos: ["rede", "cabeamento", "cabeamento estruturado", "wifi", "wi fi", "switch", "roteador", "conectividade", "firewall"],
  },
  {
    valor: "cftv",
    rotulo: "CFTV e segurança",
    termos: ["cftv", "camera", "videomonitoramento", "circuito fechado", "alarme", "controle de acesso"],
  },
  {
    valor: "suprimentos",
    rotulo: "Suprimentos",
    termos: ["suprimento", "toner", "cartucho", "material de consumo", "material de escritorio", "insumo", "fornecimento de materiais"],
  },
  {
    valor: "treinamento",
    rotulo: "Treinamento",
    termos: ["treinamento", "capacitacao", "curso", "oficina", "workshop"],
  },
  { valor: "outro", rotulo: "Outro", termos: [] },
];

const AREA_POR_VALOR: ReadonlyMap<string, AreaSugerida> = new Map(AREAS_SUGERIDAS.map((a) => [a.valor, a]));

/** "Redes e Cabeamento" vira "redes-e-cabeamento": minúscula, sem acento, até 40 caracteres. */
export function normalizarArea(texto: string): string {
  return normalizarTexto(texto).replace(/ /g, "-").slice(0, 40).replace(/-+$/, "");
}

/** Normaliza, tira vazias e repetidas e limita a 12 áreas. */
export function normalizarAreas(brutas: readonly string[]): string[] {
  const vistas = new Set<string>();
  for (const bruta of brutas) {
    const area = normalizarArea(bruta);
    if (area !== "") vistas.add(area);
    if (vistas.size >= 12) break;
  }
  return [...vistas];
}

/** Rótulo para a tela: o das áreas sugeridas ou o próprio texto, com espaços no lugar dos hifens. */
export function rotuloArea(area: string): string {
  return AREA_POR_VALOR.get(area)?.rotulo ?? area.replace(/-/g, " ");
}

export interface DocumentoAcervo {
  id: string;
  tipo: TipoAcervo;
  titulo: string;
  emissor: string;
  /** Só dígitos */
  emissorCnpj: string | null;
  descricao: string;
  areas: string[];
  valor: number | null;
  /** AAAA-MM-DD */
  periodoInicio: string | null;
  periodoFim: string | null;
  emitidoEm: string | null;
  validade: string | null;
  arquivoTipo: TipoArquivoAcervo | null;
  arquivoNome: string | null;
  arquivoTamanho: number | null;
  /** Veio de um atestado assinado no sistema */
  atestadoId: string | null;
  criadoEm: string;
}

export type DadosAcervo = Pick<
  DocumentoAcervo,
  "tipo" | "titulo" | "emissor" | "emissorCnpj" | "descricao" | "areas" | "valor" | "periodoInicio" | "periodoFim" | "emitidoEm" | "validade"
>;

const texto = (max: number) => z.string().trim().max(max);

function dataReal(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

const data = (rotulo: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || dataReal(v), `${rotulo}: data inválida.`)
    .transform((v) => (v === "" ? null : v));

/** Campos do formulário do acervo: textos aparados, CNPJ opcional (só dígitos), áreas normalizadas, datas AAAA-MM-DD. */
export const DadosAcervoSchema: z.ZodType<DadosAcervo> = z
  .object({
    tipo: z.enum(TIPOS_ACERVO, { error: "Escolha o tipo do documento." }),
    titulo: texto(200).min(1, "Informe o título do documento."),
    emissor: texto(200),
    emissorCnpj: z
      .string()
      .trim()
      .max(30)
      .transform((v) => somenteDigitos(v))
      .refine((v) => v === "" || cnpjValido(v), "CNPJ do emissor inválido.")
      .transform((v) => (v === "" ? null : v)),
    descricao: texto(2000),
    areas: z.array(z.string().max(80)).max(30).transform(normalizarAreas),
    valor: z.number().finite().min(0, "Informe um valor válido.").max(999_999_999_999).nullable(),
    periodoInicio: data("Início do período"),
    periodoFim: data("Fim do período"),
    emitidoEm: data("Data de emissão"),
    validade: data("Validade"),
  })
  .refine((d) => d.periodoInicio === null || d.periodoFim === null || d.periodoFim >= d.periodoInicio, {
    message: "O fim do período não pode ser antes do início.",
    path: ["periodoFim"],
  });

/* ---------- arquivo ---------- */

export const TIPOS_ARQUIVO_ACERVO = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type TipoArquivoAcervo = (typeof TIPOS_ARQUIVO_ACERVO)[number];

/** Limite do banco (acervo_documentos.arquivo_tamanho): 4 MB. */
export const LIMITE_ARQUIVO_ACERVO = 4 * 1024 * 1024;

const EXTENSAO: Record<TipoArquivoAcervo, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function comeca(bytes: Uint8Array, assinatura: readonly number[], desde = 0): boolean {
  return assinatura.every((b, i) => bytes[desde + i] === b);
}

/** Descobre o tipo pelos primeiros bytes (não confia no tipo que o navegador informou). */
export function tipoPeloConteudo(bytes: Uint8Array): TipoArquivoAcervo | null {
  if (comeca(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Tira caminho, aspas e caracteres de controle do nome do arquivo; garante a extensão do tipo. */
export function nomeArquivoSeguro(nome: string, tipo: TipoArquivoAcervo): string {
  const semCaminho = nome.split(/[\\/]/).pop() ?? "";
  const limpo = [...semCaminho]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127 && !'"<>:|?*'.includes(c))
    .join("")
    .trim();
  const extensao = EXTENSAO[tipo];
  const base = (limpo === "" ? "documento" : limpo).slice(0, 120);
  return base.toLowerCase().endsWith(`.${extensao}`) ? base : `${base}.${extensao}`;
}

export type ResultadoArquivo =
  | { ok: true; tipo: TipoArquivoAcervo; nome: string; tamanho: number }
  | { ok: false; erro: string };

/** Confere tamanho e tipo (pelo conteúdo) de um arquivo enviado. */
export function validarArquivoAcervo(nome: string, bytes: Uint8Array): ResultadoArquivo {
  if (bytes.length === 0) return { ok: false, erro: "O arquivo está vazio." };
  if (bytes.length > LIMITE_ARQUIVO_ACERVO) return { ok: false, erro: "O arquivo passa de 4 MB. Envie um menor." };
  const tipo = tipoPeloConteudo(bytes);
  if (tipo === null) return { ok: false, erro: "Envie um PDF ou uma imagem (PNG, JPG ou WebP)." };
  return { ok: true, tipo, nome: nomeArquivoSeguro(nome, tipo), tamanho: bytes.length };
}

/* ---------- validade ---------- */

export type EstadoValidade = "sem_validade" | "vencida" | "vencendo" | "valida";

export interface SituacaoValidade {
  estado: EstadoValidade;
  /** Dias até vencer (negativo se já venceu); null sem validade */
  dias: number | null;
  rotulo: string;
}

/** Documento com validade a menos de 30 dias do fim aparece como "vence em N dias". */
export const DIAS_AVISO_VALIDADE = 30;

const formatoDiaBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** AAAA-MM-DD de hoje no horário de Brasília. */
export function hojeEmBrasilia(agora: number): string {
  return formatoDiaBrasilia.format(new Date(agora));
}

function diasEntre(deIso: string, ateIso: string): number {
  return Math.round((Date.parse(`${ateIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`)) / 86_400_000);
}

export function situacaoValidade(validade: string | null, agora: number): SituacaoValidade {
  if (validade === null || !dataReal(validade)) return { estado: "sem_validade", dias: null, rotulo: "" };
  const dias = diasEntre(hojeEmBrasilia(agora), validade);
  if (dias < 0) return { estado: "vencida", dias, rotulo: "Vencida" };
  if (dias === 0) return { estado: "vencendo", dias, rotulo: "Vence hoje" };
  if (dias <= DIAS_AVISO_VALIDADE) return { estado: "vencendo", dias, rotulo: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}` };
  return { estado: "valida", dias, rotulo: "Válida" };
}

/* ---------- filtros da lista ---------- */

export interface FiltroAcervo {
  tipo: TipoAcervo | null;
  area: string | null;
  busca: string;
}

/** Aplica tipo, área e busca (sem acento) sobre título, emissor, descrição e áreas. */
export function filtrarAcervo(documentos: readonly DocumentoAcervo[], filtro: FiltroAcervo): DocumentoAcervo[] {
  const palavras = normalizarTexto(filtro.busca).split(" ").filter((p) => p !== "");
  return documentos.filter((d) => {
    if (filtro.tipo !== null && d.tipo !== filtro.tipo) return false;
    if (filtro.area !== null && !d.areas.includes(filtro.area)) return false;
    if (palavras.length === 0) return true;
    const alvo = normalizarTexto([d.titulo, d.emissor, d.descricao, ...d.areas.map(rotuloArea)].join(" "));
    return palavras.every((p) => alvo.includes(p));
  });
}

/** Áreas usadas nos documentos, na ordem das sugeridas e depois as livres em ordem alfabética. */
export function areasEmUso(documentos: readonly DocumentoAcervo[]): string[] {
  const usadas = new Set(documentos.flatMap((d) => d.areas));
  const sugeridas = AREAS_SUGERIDAS.map((a) => a.valor).filter((v) => usadas.has(v));
  const livres = [...usadas].filter((a) => !AREA_POR_VALOR.has(a)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...sugeridas, ...livres];
}

/* ---------- sugestões para uma licitação ---------- */

export interface SugestaoAcervo {
  documento: DocumentoAcervo;
  pontos: number;
  /** "Bate com: site institucional" */
  motivo: string;
}

/** Palavras comuns demais para provar afinidade com o objeto de uma licitação. */
const PALAVRAS_FRACAS = new Set(
  normalizarTexto(
    "atestado capacidade tecnica servicos servico prestacao prestados fornecimento contratacao empresa contrato certidao documento nota fiscal para com sem das dos uma municipio prefeitura secretaria orgao publico geral gerais diversos diversas outros outras conforme referente objeto",
  ).split(" "),
);

function palavrasFortes(textoLivre: string): string[] {
  const vistas = new Set<string>();
  for (const p of normalizarTexto(textoLivre).split(" ")) {
    if (p.length >= 4 && !PALAVRAS_FRACAS.has(p)) vistas.add(p);
  }
  return [...vistas];
}

const PONTOS_AREA = 3;
const PONTOS_TITULO = 2;
const PONTOS_DESCRICAO = 1;
const MAX_PONTOS_DESCRICAO = 3;
const MINIMO_PARA_SUGERIR = 2;

/**
 * Documentos do acervo que servem para o objeto de uma licitação, do melhor para o pior.
 * Pontua o casamento do objeto com as áreas (3), com o título (2 por palavra) e com a descrição (1 por palavra, até 3).
 * Documento com validade vencida fica de fora.
 */
export function sugerirDoAcervo(
  objeto: string,
  documentos: readonly DocumentoAcervo[],
  max = 5,
  agora: number = Date.now(),
): SugestaoAcervo[] {
  const alvo = normalizarTexto(objeto);
  if (alvo === "" || max <= 0) return [];
  const bate = (termo: string): boolean => regexDoTermo(termo).test(alvo);

  const sugestoes: SugestaoAcervo[] = [];
  for (const documento of documentos) {
    if (situacaoValidade(documento.validade, agora).estado === "vencida") continue;
    let pontos = 0;
    const motivos: string[] = [];

    for (const area of documento.areas) {
      const sugerida = AREA_POR_VALOR.get(area);
      const termos = sugerida ? sugerida.termos : [area.replace(/-/g, " ")];
      if (termos.some((t) => t !== "" && bate(t))) {
        pontos += PONTOS_AREA;
        motivos.push(rotuloArea(area).toLowerCase());
      }
    }

    const noTitulo = palavrasFortes(documento.titulo).filter(bate);
    pontos += noTitulo.length * PONTOS_TITULO;
    motivos.push(...noTitulo);

    const noTexto = palavrasFortes(documento.descricao).filter((p) => !noTitulo.includes(p) && bate(p));
    pontos += Math.min(noTexto.length * PONTOS_DESCRICAO, MAX_PONTOS_DESCRICAO);
    motivos.push(...noTexto.slice(0, MAX_PONTOS_DESCRICAO));

    if (pontos < MINIMO_PARA_SUGERIR) continue;
    const unicos = [...new Set(motivos)].slice(0, 3);
    sugestoes.push({ documento, pontos, motivo: `Bate com: ${unicos.join(", ")}` });
  }

  return sugestoes
    .sort((a, b) => b.pontos - a.pontos || b.documento.criadoEm.localeCompare(a.documento.criadoEm))
    .slice(0, max);
}

/* ---------- exibição ---------- */

/** "2025-03-09" vira "09/03/2025"; qualquer outra coisa vira "". */
export function formatarDataIso(iso: string | null): string {
  if (iso === null || !dataReal(iso)) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "03/2025 a 12/2025", "desde 03/2025", "até 12/2025" ou "" (mês e ano bastam para um atestado). */
export function textoPeriodo(inicio: string | null, fim: string | null): string {
  const mes = (iso: string | null): string => (iso !== null && dataReal(iso) ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  const de = mes(inicio);
  const ate = mes(fim);
  if (de !== "" && ate !== "") return de === ate ? de : `${de} a ${ate}`;
  if (de !== "") return `desde ${de}`;
  return ate === "" ? "" : `até ${ate}`;
}
