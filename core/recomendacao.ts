import { normalizarTexto, regexDoTermo, removerSetorDeSistemas } from "./cnae-keywords";
import { TODOS_CNAES, frenteDoCnae } from "./empresa";
import { MS_POUCO_TEMPO, TETO_MEI_ANO_CHEIO, VALOR_MINIMO, limiteMeiAnual } from "./score";
import type { Frente, OportunidadeComScore } from "./types";
import type { Preferencias } from "./types-equipe";

/** Só as listas de termos importam aqui; e-mails e resumo ficam de fora. */
export type PreferenciasDeRecomendacao = Pick<Preferencias, "termosPrioritarios" | "termosBloqueadosParaVoce">;

export interface Recomendacao {
  item: OportunidadeComScore;
  /** Até 3 frases curtas, escritas para o dono ler */
  motivos: string[];
  prioridade: number;
}

const MS_DIA = 24 * 3_600_000;
const MAX_MOTIVOS = 3;
const MAX_POR_ORGAO = 3;

const CNAE_PRINCIPAL = TODOS_CNAES.find((c) => c.principal)?.codigo;

/** Bônus de quem casa com um termo que o dono quer priorizar. */
const BONUS_FOCO = 10;

/**
 * Bônus de quem casa com a área de TI da empresa (software, redes, suporte, informática) sem bater
 * em nenhum termo de foco. Só vale quando há preferências, para manter o cálculo antigo sem elas.
 */
const BONUS_AREA_TI = 6;
const CNAES_DE_TI: ReadonlyArray<string> = ["95.11-8-00", "61.90-6-99", "47.51-2-01"];

/**
 * "Sistema" sozinho engana: sistema de registro de preços, de ar condicionado, de incêndio...
 * Estes trechos saem do texto antes de procurar os termos prioritários.
 */
export const SISTEMA_QUE_NAO_E_TI =
  /(?<![a-z0-9])sistemas? (?:de |do |da |dos |das )?(?:registro de precos?|srp|ar condicionado|climatizacao|refrigeracao|ventilacao|exaustao|combate a incendio|incendio|alarme|viario|hidraulic\w*|sanitari\w*|esgoto|drenagem|abastecimento|agua|eletric\w*|energia|spda|protecao catodica|suspensao|freios?|impermeabilizacao|cftv|seguranca eletronica)/g;

const TERMO_DE_SOFTWARE = /sistema|software|licenc|aplicativo|desenvolvimento|nuvem|plataforma|programa/;
const TERMO_DE_SERVICO_TI =
  /(?<![a-z0-9])ti(?![a-z0-9])|tic|informatica|tecnologia|suporte|rede|cabeamento|computador|notebook|impress|outsourcing|manutencao/;

interface TermoCompilado {
  termo: string;
  regex: RegExp;
}

function compilar(termos: ReadonlyArray<string>): TermoCompilado[] {
  const vistos = new Set<string>();
  const lista: TermoCompilado[] = [];
  for (const bruto of termos) {
    const termo = normalizarTexto(bruto);
    if (termo === "" || vistos.has(termo)) continue;
    vistos.add(termo);
    lista.push({ termo, regex: regexDoTermo(termo) });
  }
  return lista;
}

function motivoDoFoco(termo: string): string {
  if (TERMO_DE_SOFTWARE.test(termo)) return "Sistema/software: seu foco";
  if (TERMO_DE_SERVICO_TI.test(termo)) return "Serviço de TI: seu foco";
  return `Seu foco: ${termo}`;
}

interface Pista {
  bonus: number;
  motivo: string;
}

function diasParaCotar(dias: number): string {
  return dias === 1 ? "1 dia para cotar" : `${dias} dias para cotar`;
}

function anoDoEncerramento(dataEncerramento: string): number {
  return Number(dataEncerramento.slice(0, 4));
}

function pistas(
  item: OportunidadeComScore,
  frente: Frente,
  restanteMs: number,
  textoFoco: string,
  prioritarios: ReadonlyArray<TermoCompilado>,
  comPreferencias: boolean,
): Pista[] {
  const lista: Pista[] = [];
  const foco = prioritarios.find((t) => t.regex.test(textoFoco));
  if (foco) lista.push({ bonus: BONUS_FOCO, motivo: motivoDoFoco(foco.termo) });
  else if (comPreferencias && item.score.cnaesCasados.some((c) => CNAES_DE_TI.includes(c) && frenteDoCnae(c) === frente)) {
    lista.push({ bonus: BONUS_AREA_TI, motivo: "Tecnologia da informação: seu foco" });
  }

  if (item.regiao === "nova-iguacu") lista.push({ bonus: 8, motivo: "Na sua cidade" });
  else if (item.regiao === "baixada") lista.push({ bonus: 5, motivo: "Na Baixada, perto de casa" });

  const principal = CNAE_PRINCIPAL;
  if (principal && frente === frenteDoCnae(principal) && item.score.cnaesCasados.includes(principal)) {
    lista.push({ bonus: 4, motivo: "É a sua atividade principal" });
  }

  if (item.modalidadeId === 8) lista.push({ bonus: 4, motivo: "Dispensa: disputa simples" });

  if (item.valorEstimado !== null && item.valorEstimado >= VALOR_MINIMO) {
    const ano = anoDoEncerramento(item.dataEncerramento);
    if (item.valorEstimado <= limiteMeiAnual(ano)) {
      lista.push({ bonus: 3, motivo: `Cabe no limite do MEI de ${ano}` });
    }
  }

  if (restanteMs >= MS_DIA && restanteMs <= 5 * MS_DIA) {
    lista.push({ bonus: 3, motivo: diasParaCotar(Math.floor(restanteMs / MS_DIA)) });
  }
  return lista;
}

/**
 * Escolhe as oportunidades que mais combinam com o perfil da empresa na frente ativa.
 * Só entram faixa go ou atenção com CNAE casado na frente ativa, ainda abertas há 6 h ou mais
 * e dentro do teto anual do MEI. Serviço fora do estado do Rio não entra (é presencial).
 * Com preferências: objeto que contém um termo bloqueado fica de fora (continua em "Todas")
 * e objeto que contém um termo prioritário ganha 10 pontos de prioridade.
 * Função pura.
 */
export function recomendar(
  lista: ReadonlyArray<OportunidadeComScore>,
  frente: Frente,
  agora: Date,
  limite = 12,
  preferencias?: PreferenciasDeRecomendacao,
): Recomendacao[] {
  const bloqueados = compilar(preferencias?.termosBloqueadosParaVoce ?? []);
  const prioritarios = compilar(preferencias?.termosPrioritarios ?? []);
  const candidatas: Recomendacao[] = [];
  for (const item of lista) {
    if (item.score.faixa === "nogo") continue;
    if (item.score.frenteCasada !== frente) continue;
    if (item.valorEstimado !== null && item.valorEstimado > TETO_MEI_ANO_CHEIO) continue;
    if (frente === "servicos" && item.regiao === "fora-rj") continue;

    const restante = Date.parse(item.dataEncerramento) - agora.getTime();
    if (Number.isNaN(restante) || restante < MS_POUCO_TEMPO) continue;

    const texto = normalizarTexto(item.objeto);
    if (bloqueados.some((t) => t.regex.test(texto))) continue;

    const achadas = pistas(item, frente, restante, removerSetorDeSistemas(texto).replace(SISTEMA_QUE_NAO_E_TI, " "), prioritarios, preferencias !== undefined);
    const prioridade = item.score.total + achadas.reduce((soma, p) => soma + p.bonus, 0);
    const motivos = [...achadas]
      .sort((a, b) => b.bonus - a.bonus)
      .slice(0, MAX_MOTIVOS)
      .map((p) => p.motivo);
    candidatas.push({ item, motivos: motivos.length > 0 ? motivos : ["Casa com a sua atividade"], prioridade });
  }

  const prazo = (r: Recomendacao): number => Date.parse(r.item.dataEncerramento);
  candidatas.sort((a, b) => b.prioridade - a.prioridade || prazo(a) - prazo(b));

  const porOrgao = new Map<string, number>();
  const escolhidas: Recomendacao[] = [];
  for (const candidata of candidatas) {
    if (escolhidas.length >= limite) break;
    const chave = candidata.item.orgaoCnpj || candidata.item.orgao;
    const usadas = porOrgao.get(chave) ?? 0;
    if (usadas >= MAX_POR_ORGAO) continue;
    porOrgao.set(chave, usadas + 1);
    escolhidas.push(candidata);
  }
  return escolhidas;
}
