import { z } from "zod";
import { normalizarTexto } from "./cnae-keywords";
import type { Preferencias } from "./types-equipe";

/** Mesmos termos que a migração 004 grava na primeira execução. */
export const PREFERENCIAS_PADRAO: Readonly<Preferencias> = {
  termosPrioritarios: [
    "sistema",
    "software",
    "licenca de software",
    "desenvolvimento de sistema",
    "sistema de gestao",
    "empresa especializada em servicos de ti",
    "servicos de tecnologia da informacao",
    "suporte tecnico",
    "manutencao de computadores",
    "rede logica",
    "cabeamento estruturado",
    "outsourcing de impressao",
  ],
  termosBloqueadosParaVoce: [
    "cftv",
    "camera",
    "cameras",
    "videomonitoramento",
    "video monitoramento",
    "monitoramento eletronico",
    "alarme",
  ],
  emailsResumo: ["arthurfoxinfo@gmail.com"],
  resumoAtivo: true,
  capitalMaximo: null,
  diasMaximosParado: null,
};

export const MAX_TERMOS = 60;
export const MAX_EMAILS = 10;
const MAX_TAMANHO_TERMO = 80;

/** Minúsculas, sem acento, aparados, sem vazios e sem repetidos. A ordem de entrada é mantida. */
export function normalizarTermos(termos: ReadonlyArray<string>): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of termos) {
    const termo = normalizarTexto(bruto);
    if (termo === "" || vistos.has(termo)) continue;
    vistos.add(termo);
    saida.push(termo);
  }
  return saida;
}

/** E-mails em minúsculas, aparados e sem repetidos. */
export function normalizarEmails(emails: ReadonlyArray<string>): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of emails) {
    const email = bruto.trim().toLowerCase();
    if (email === "" || vistos.has(email)) continue;
    vistos.add(email);
    saida.push(email);
  }
  return saida;
}

const termoSchema = z.string().max(MAX_TAMANHO_TERMO, "Termo muito longo");

export const preferenciasSchema = z
  .object({
    termosPrioritarios: z.array(termoSchema).max(MAX_TERMOS, "Muitos termos"),
    termosBloqueadosParaVoce: z.array(termoSchema).max(MAX_TERMOS, "Muitos termos"),
    emailsResumo: z.array(z.string().trim().toLowerCase().pipe(z.email("E-mail inválido"))).max(MAX_EMAILS, "Muitos e-mails"),
    resumoAtivo: z.boolean(),
    capitalMaximo: z.number("Capital máximo inválido").min(0, "Capital máximo inválido").max(1_000_000_000, "Capital máximo alto demais").nullish(),
    diasMaximosParado: z
      .number("Dias máximos inválido")
      .int("Dias máximos precisa ser um número inteiro")
      .min(0, "Dias máximos inválido")
      .max(3650, "Dias máximos alto demais")
      .nullish(),
  })
  .transform(
    (p): Preferencias => ({
      termosPrioritarios: normalizarTermos(p.termosPrioritarios),
      termosBloqueadosParaVoce: normalizarTermos(p.termosBloqueadosParaVoce),
      emailsResumo: normalizarEmails(p.emailsResumo),
      resumoAtivo: p.resumoAtivo,
      capitalMaximo: p.capitalMaximo ?? null,
      diasMaximosParado: p.diasMaximosParado ?? null,
    }),
  );

/** Copia dos padrões: quem recebe pode alterar sem afetar a constante. */
export function preferenciasPadrao(): Preferencias {
  return {
    termosPrioritarios: [...PREFERENCIAS_PADRAO.termosPrioritarios],
    termosBloqueadosParaVoce: [...PREFERENCIAS_PADRAO.termosBloqueadosParaVoce],
    emailsResumo: [...PREFERENCIAS_PADRAO.emailsResumo],
    resumoAtivo: PREFERENCIAS_PADRAO.resumoAtivo,
    capitalMaximo: PREFERENCIAS_PADRAO.capitalMaximo,
    diasMaximosParado: PREFERENCIAS_PADRAO.diasMaximosParado,
  };
}
