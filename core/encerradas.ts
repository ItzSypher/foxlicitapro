/**
 * Licitação "encerrada": o prazo de propostas passou e a equipe não levou o item adiante.
 * O estado é derivado na leitura (data + etapa); nada é gravado no banco.
 */

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;

/** Etapas em que o prazo vencido tira o item do pipeline. Disputa, ganha e perdida nunca encerram. */
export const ETAPAS_QUE_ENCERRAM: ReadonlyArray<string> = [
  "radar",
  "analisando",
  "cotando",
  "revisao_juridica",
  "proposta",
];

function instante(valor: Date | number): number {
  return typeof valor === "number" ? valor : valor.getTime();
}

/** Verdadeiro quando a data de encerramento já passou e a etapa ainda é anterior à disputa. Sem data válida: falso. */
export function ehEncerrado(
  etapa: string,
  dataEncerramento: string | null | undefined,
  agora: Date | number,
): boolean {
  if (!ETAPAS_QUE_ENCERRAM.includes(etapa)) return false;
  if (dataEncerramento === null || dataEncerramento === undefined || dataEncerramento === "") return false;
  const fim = Date.parse(dataEncerramento);
  if (Number.isNaN(fim)) return false;
  return fim < instante(agora);
}

/** Separa os itens em abertos (seguem no pipeline) e encerrados, mantendo a ordem de entrada. */
export function separarEncerrados<T>(
  itens: ReadonlyArray<T>,
  ler: (item: T) => { etapa: string; dataEncerramento: string | null },
  agora: Date | number,
): { abertos: T[]; encerrados: T[] } {
  const abertos: T[] = [];
  const encerrados: T[] = [];
  for (const item of itens) {
    const { etapa, dataEncerramento } = ler(item);
    if (ehEncerrado(etapa, dataEncerramento, agora)) encerrados.push(item);
    else abertos.push(item);
  }
  return { abertos, encerrados };
}

/** Do que encerrou há menos tempo para o mais antigo. Não altera a lista recebida. */
export function maisRecentesPrimeiro<T>(itens: ReadonlyArray<T>, data: (item: T) => string): T[] {
  return [...itens].sort((a, b) => Date.parse(data(b)) - Date.parse(data(a)));
}

/** "encerrou há 3 dias", "encerrou há 5 h", "encerrou há pouco". */
export function textoEncerrou(dataEncerramento: string, agora: Date | number): string {
  const fim = Date.parse(dataEncerramento);
  if (Number.isNaN(fim)) return "encerrada";
  const passado = instante(agora) - fim;
  if (passado < MS_HORA) return "encerrou há pouco";
  if (passado < MS_DIA) return `encerrou há ${Math.floor(passado / MS_HORA)} h`;
  const dias = Math.floor(passado / MS_DIA);
  return `encerrou há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** "1 licitação encerrou o prazo" / "3 licitações encerraram o prazo". */
export function frasePrazoEncerrado(quantidade: number): string {
  return quantidade === 1
    ? "1 licitação encerrou o prazo."
    : `${quantidade} licitações encerraram o prazo.`;
}
