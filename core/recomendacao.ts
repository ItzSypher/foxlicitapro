import { TODOS_CNAES, frenteDoCnae } from "./empresa";
import { MS_POUCO_TEMPO, TETO_MEI_ANO_CHEIO, VALOR_MINIMO, limiteMeiAnual } from "./score";
import type { Frente, OportunidadeComScore } from "./types";

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

function pistas(item: OportunidadeComScore, frente: Frente, restanteMs: number): Pista[] {
  const lista: Pista[] = [];
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
 * Função pura.
 */
export function recomendar(
  lista: ReadonlyArray<OportunidadeComScore>,
  frente: Frente,
  agora: Date,
  limite = 12,
): Recomendacao[] {
  const candidatas: Recomendacao[] = [];
  for (const item of lista) {
    if (item.score.faixa === "nogo") continue;
    if (item.score.frenteCasada !== frente) continue;
    if (item.valorEstimado !== null && item.valorEstimado > TETO_MEI_ANO_CHEIO) continue;
    if (frente === "servicos" && item.regiao === "fora-rj") continue;

    const restante = Date.parse(item.dataEncerramento) - agora.getTime();
    if (Number.isNaN(restante) || restante < MS_POUCO_TEMPO) continue;

    const achadas = pistas(item, frente, restante);
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
