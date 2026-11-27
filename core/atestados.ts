import { z } from "zod";
import { cnpjValido, formatarCnpj, somenteDigitos } from "./brasilapi";
import { valorPorExtenso } from "./proposta";

/** Atestado de capacidade técnica: regras puras (validação, texto padrão, hash, código, status). */

export const STATUS_ATESTADO = ["rascunho", "aguardando", "assinado", "cancelado"] as const;
export type StatusAtestado = (typeof STATUS_ATESTADO)[number];

export const ROTULO_STATUS: Record<StatusAtestado, string> = {
  rascunho: "Rascunho",
  aguardando: "Aguardando assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

/** O link do cliente vale por este tempo. */
export const DIAS_VALIDADE_LINK = 30;
export const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;
/** O banco aceita até 400000 caracteres na assinatura; fica uma folga. */
export const LIMITE_ASSINATURA = 350_000;

export function ehStatusAtestado(valor: unknown): valor is StatusAtestado {
  return typeof valor === "string" && (STATUS_ATESTADO as readonly string[]).includes(valor);
}

const TRANSICOES: Record<StatusAtestado, readonly StatusAtestado[]> = {
  rascunho: ["aguardando", "cancelado"],
  aguardando: ["assinado", "cancelado", "rascunho"],
  assinado: [],
  cancelado: [],
};

export function transicaoValida(de: StatusAtestado, para: StatusAtestado): boolean {
  return TRANSICOES[de].includes(para);
}

/** Só rascunho e aguardando mudam de conteúdo; depois de assinado o texto é imutável. */
export function podeEditar(status: StatusAtestado): boolean {
  return status === "rascunho" || status === "aguardando";
}

export function podeGerarLink(status: StatusAtestado): boolean {
  return podeEditar(status);
}

export function podeCancelar(status: StatusAtestado): boolean {
  return transicaoValida(status, "cancelado");
}

/** O cliente só assina com o link aguardando e dentro do prazo. */
export function podeAssinar(status: StatusAtestado, tokenExpira: Date | null, agora: Date): boolean {
  return status === "aguardando" && tokenExpira !== null && tokenExpira.getTime() > agora.getTime();
}

// ---------- validação ----------

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataReal(iso: string): boolean {
  if (!DATA.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

const textoCurto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || dataReal(v), "Data inválida.");

/** Aceita número ou texto ("1.234,56"); vazio vira null. */
export function lerValor(bruto: unknown): number | null {
  if (bruto === null || bruto === undefined || bruto === "") return null;
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : Number.NaN;
  if (typeof bruto !== "string") return Number.NaN;
  const limpo = bruto.replace(/[R$\s]/g, "");
  if (limpo === "") return null;
  const milhar = /^\d{1,3}(\.\d{3})+$/.test(limpo);
  const normal = limpo.includes(",") || milhar ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : Number.NaN;
}

const valorSchema = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => lerValor(v))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100_000_000_000), "Informe um valor válido.");

export const CamposAtestadoSchema = z.object({
    clienteNome: z.string().trim().min(1, "Informe o nome do cliente.").max(200, "O nome do cliente passa de 200 caracteres."),
    clienteCnpj: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : somenteDigitos(v)))
      .refine((v) => v === null || cnpjValido(v), "CNPJ do cliente inválido. Confira os 14 dígitos."),
    clienteEndereco: textoCurto(300),
    responsavelNome: textoCurto(120),
    responsavelCargo: textoCurto(80),
    responsavelContato: textoCurto(120),
    objeto: z.string().trim().min(3, "Descreva os serviços prestados.").max(2000, "A descrição dos serviços passa de 2000 caracteres."),
    areas: z
      .array(z.string().trim().min(1).max(40))
      .max(12, "Use até 12 áreas.")
      .transform((lista) => [...new Set(lista.map((a) => a.toLowerCase()))]),
    periodoInicio: dataOpcional,
    periodoFim: dataOpcional,
    valor: valorSchema,
    texto: z.string().trim().min(20, "Escreva o texto do atestado.").max(8000, "O texto passa de 8000 caracteres."),
});

export const DadosAtestadoSchema = CamposAtestadoSchema.refine((d) => d.periodoInicio === null || d.periodoFim === null || d.periodoFim >= d.periodoInicio, {
    message: "O fim do período não pode ser antes do início.",
    path: ["periodoFim"],
  });

export type DadosAtestado = z.output<typeof DadosAtestadoSchema>;

/** CPF com dígitos verificadores. */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string): number => {
    const soma = [...base].reduce((acc, c, i) => acc + Number(c) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

export const AssinaturaClienteSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo.").max(120, "O nome passa de 120 caracteres."),
  cargo: z.string().trim().min(2, "Informe seu cargo ou função.").max(80, "O cargo passa de 80 caracteres."),
  documento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : somenteDigitos(v)))
    .refine((v) => v === null || cpfValido(v), "CPF inválido. Confira os 11 dígitos ou deixe em branco."),
  assinatura: z
    .string()
    .max(LIMITE_ASSINATURA, "A assinatura ficou pesada demais. Limpe e assine de novo.")
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Assine na área indicada."),
  declaracao: z.literal(true, { error: "Marque a declaração para confirmar." }),
});

export type AssinaturaCliente = z.output<typeof AssinaturaClienteSchema>;

// ---------- texto ----------

const MASCARA_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** AAAA-MM-DD para DD/MM/AAAA; qualquer outra coisa volta como veio. */
export function dataBr(iso: string): string {
  const m = MASCARA_DATA.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "10/01/2026 a 30/06/2026", "desde …", "até …" ou aviso de que não há período. */
export function periodoTexto(a: { periodoInicio: string | null; periodoFim: string | null }): string {
  if (a.periodoInicio && a.periodoFim) return `${dataBr(a.periodoInicio)} a ${dataBr(a.periodoFim)}`;
  if (a.periodoInicio) return `desde ${dataBr(a.periodoInicio)}`;
  if (a.periodoFim) return `até ${dataBr(a.periodoFim)}`;
  return "Período não informado";
}

const moedaBr = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EntradaTextoPadrao {
  emissoraRazaoSocial: string;
  emissoraCnpj: string;
  clienteNome: string;
  clienteCnpj: string | null;
  objeto: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  valor: number | null;
}

function trechoPeriodo(inicio: string | null, fim: string | null): string {
  if (inicio && fim) return `, no período de ${dataBr(inicio)} a ${dataBr(fim)}`;
  if (inicio) return `, a partir de ${dataBr(inicio)}`;
  if (fim) return `, até ${dataBr(fim)}`;
  return "";
}

/** Modelo formal em três parágrafos; partes que faltam (CNPJ, período, valor) são omitidas, nunca inventadas. */
export function textoPadraoAtestado(d: EntradaTextoPadrao): string {
  const cnpjEmissora = d.emissoraCnpj.trim() === "" ? "" : `, inscrita no CNPJ sob o nº ${formatarCnpj(d.emissoraCnpj)}`;
  const cnpjCliente = d.clienteCnpj ? `, inscrita no CNPJ sob o nº ${formatarCnpj(d.clienteCnpj)}` : "";
  const valor =
    d.valor !== null && d.valor > 0 ? `, no valor de R$ ${moedaBr.format(d.valor)} (${valorPorExtenso(d.valor)})` : "";
  const objeto = d.objeto.trim().replace(/[.;\s]+$/, "");

  const abertura =
    `Atestamos, para os devidos fins, que a empresa ${d.emissoraRazaoSocial.trim()}${cnpjEmissora}, ` +
    `prestou a esta ${d.clienteNome.trim()}${cnpjCliente}, os serviços de ${objeto}` +
    `${trechoPeriodo(d.periodoInicio, d.periodoFim)}${valor}.`;
  const conduta =
    "Os serviços foram executados de forma satisfatória, com cumprimento dos prazos e das especificações combinadas, " +
    "nada constando que desabone a empresa.";
  const fecho = "Por ser expressão da verdade, firmamos o presente atestado para que produza os seus efeitos.";
  return [abertura, conduta, fecho].join("\n\n");
}

/** Parágrafos do texto para o documento (linhas em branco separam). */
export function paragrafosDoTexto(texto: string): string[] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

// ---------- hash e código ----------

export interface ConteudoAssinado {
  empresaId: string;
  clienteNome: string;
  clienteCnpj: string | null;
  objeto: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  valor: number | null;
  texto: string;
  assinanteNome: string;
  assinanteCargo: string;
  /** ISO do instante da assinatura */
  assinadoEm: string;
}

const normalizar = (t: string): string => t.replace(/\r\n?/g, "\n").trim();

/**
 * Texto estável que entra no SHA-256: campos em ordem fixa, textos normalizados, valor com 2 casas.
 * Quem recalcula (verificação) obtém exatamente a mesma sequência.
 */
export function conteudoParaHash(c: ConteudoAssinado): string {
  return JSON.stringify({
    versao: 1,
    empresaId: c.empresaId,
    clienteNome: normalizar(c.clienteNome),
    clienteCnpj: c.clienteCnpj ? somenteDigitos(c.clienteCnpj) : "",
    objeto: normalizar(c.objeto),
    periodoInicio: c.periodoInicio ?? "",
    periodoFim: c.periodoFim ?? "",
    valor: c.valor === null ? "" : c.valor.toFixed(2),
    texto: normalizar(c.texto),
    assinanteNome: normalizar(c.assinanteNome),
    assinanteCargo: normalizar(c.assinanteCargo),
    assinadoEm: new Date(c.assinadoEm).toISOString(),
  });
}

/** Sem 0, O, 1, I: confunde ao ditar. 32 símbolos, então `byte & 31` não tem viés. */
export const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 8;

/** Código curto de verificação a partir de bytes aleatórios (pelo menos 8). */
export function gerarCodigo(aleatorio: ArrayLike<number>): string {
  if (aleatorio.length < TAMANHO_CODIGO) throw new Error("Bytes aleatórios insuficientes para o código.");
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO; i += 1) codigo += ALFABETO_CODIGO[aleatorio[i] & 31];
  return codigo;
}

/** Aceita o código como digitado ("abcd-efgh"); devolve maiúsculo e sem separadores, ou null se não tiver o formato. */
export function normalizarCodigo(bruto: string): string | null {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length !== TAMANHO_CODIGO) return null;
  return [...limpo].every((c) => ALFABETO_CODIGO.includes(c)) ? limpo : null;
}

// ---------- assistente ----------

/** Números (com separadores, como "12.500,00" ou "10/01/2026") que aparecem no texto. */
function numerosBrutos(texto: string): string[] {
  return texto.match(/\d[\d.,/-]*\d|\d/g) ?? [];
}

const gruposDe = (bruto: string): string[] => bruto.match(/\d+/g) ?? [];

/**
 * Números do texto gerado que não existem nos dados informados: sinal de que o assistente inventou algo.
 * Vale o número inteiro ("12.500,00") ou, escrito de outro jeito ("10 de janeiro"), todos os seus grupos de dígitos.
 */
export function numerosInventados(textoGerado: string, dadosInformados: string): string[] {
  const brutosPermitidos = numerosBrutos(dadosInformados);
  const permitidos = new Set([...brutosPermitidos.map((b) => b.replace(/\D/g, "")), ...brutosPermitidos.flatMap(gruposDe)]);
  const inventados = numerosBrutos(textoGerado)
    .filter((b) => !permitidos.has(b.replace(/\D/g, "")) && !gruposDe(b).every((g) => permitidos.has(g)))
    .map((b) => b.replace(/\D/g, ""));
  return [...new Set(inventados)];
}

export const SISTEMA_ATESTADO =
  "Você redige atestados de capacidade técnica em português do Brasil, em linguagem formal e objetiva, " +
  "na terceira pessoa do plural (\"Atestamos\"). Use somente os fatos informados. " +
  "Não invente números, datas, valores, prazos, nomes, contratos nem resultados. " +
  "Se um dado não foi informado, não o mencione. Devolva apenas o texto do atestado, em três a quatro parágrafos " +
  "separados por uma linha em branco, sem título, sem assinatura, sem marcação e sem comentários.";

/** Pedido ao assistente: dados do atestado mais o que a empresa descreveu sobre os serviços. */
export function pedidoRedacaoAtestado(d: EntradaTextoPadrao & { descricao: string }): string {
  const linhas = [
    `Empresa que prestou o serviço: ${d.emissoraRazaoSocial}${d.emissoraCnpj ? ` (CNPJ ${formatarCnpj(d.emissoraCnpj)})` : ""}`,
    `Cliente que atesta: ${d.clienteNome}${d.clienteCnpj ? ` (CNPJ ${formatarCnpj(d.clienteCnpj)})` : ""}`,
    d.periodoInicio || d.periodoFim ? `Período: ${d.periodoInicio ? dataBr(d.periodoInicio) : "não informado"} a ${d.periodoFim ? dataBr(d.periodoFim) : "não informado"}` : "",
    d.valor !== null && d.valor > 0 ? `Valor: R$ ${moedaBr.format(d.valor)}` : "",
    `Serviços prestados, como a empresa descreveu:\n${d.descricao.trim() || d.objeto.trim()}`,
  ].filter((l) => l !== "");
  return `${linhas.join("\n")}\n\nRedija o atestado. Comece com "Atestamos, para os devidos fins, que a empresa" e termine com uma frase de encerramento.`;
}

// ---------- envio ao cliente ----------

/** Mensagem pronta para o WhatsApp. */
export function mensagemWhatsAppAtestado(d: { cliente: string; emissora: string; link: string; responsavel?: string | null }): string {
  const saudacao = d.responsavel && d.responsavel.trim() !== "" ? `Olá, ${d.responsavel.trim()}!` : "Olá!";
  return (
    `${saudacao} Aqui é da ${d.emissora}. Preparamos o atestado de capacidade técnica dos serviços prestados a ${d.cliente}. ` +
    `Pode ler e assinar pelo celular, em um minuto: ${d.link}`
  );
}

/** Link wa.me com o texto pronto; com telefone (só dígitos, DDD), abre direto na conversa. */
export function linkWhatsApp(texto: string, telefone?: string | null): string {
  let digitos = telefone ? somenteDigitos(telefone) : "";
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  if (digitos.length < 12 || digitos.length > 13) digitos = "";
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

/** Telefone dentro de "e-mail ou telefone": devolve só se parecer telefone. */
export function telefoneDoContato(contato: string | null): string | null {
  if (!contato || contato.includes("@")) return null;
  const d = somenteDigitos(contato);
  return d.length >= 10 && d.length <= 13 ? d : null;
}

export function urlAtestadoPublico(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/atestado/${token}`;
}

export function urlVerificacao(base: string, codigo: string): string {
  return `${base.replace(/\/+$/, "")}/atestado/verificar/${codigo}`;
}

export { BASE_PADRAO_APP } from "./app-base";
