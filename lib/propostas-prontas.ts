import "server-only";
import { escolherParaProposta, propostaProntaLigada, MAXIMO_PRONTAS_POR_EMPRESA } from "@/core/propostas-prontas";
import type { LimitesCaixa } from "@/core/caixa";
import type { OportunidadeComScore } from "@/core/types";
import type { Sessao } from "@/core/types-equipe";
import { lerEmpresa, listarIdsEmpresasAtivas } from "@/db/empresas";
import { lerPreferencias } from "@/db/preferencias";
import { listarPropostas } from "@/db/propostas";
import { lerUsuario } from "@/db/usuarios";
import { lerResponsavelPadrao } from "@/db/whatsapp";
import { restantesHoje } from "@/lib/assistente/cota";
import { montarPropostaComAssistente } from "@/lib/assistente/proposta";
import { assistenteDisponivel } from "@/lib/gemini";
import { obterRadar } from "@/lib/radar-dados";

export interface ResultadoPropostasEmpresa {
  empresaId: string;
  /** Rascunhos criados agora, já em revisão */
  criadas: number;
  /** Escolhidas que não viraram proposta (assistente falhou, limite do dia) */
  falhas: number;
  /** Por que nada foi feito, quando for o caso */
  motivo?: string;
}

export interface ResumoPropostasProntas {
  ligado: boolean;
  empresas: ResultadoPropostasEmpresa[];
}

/** Falhas seguidas do assistente numa empresa antes de desistir dela (cada tentativa custa uma chamada de IA). */
const MAX_FALHAS_SEGUIDAS = 2;

async function sessaoDoResponsavel(empresaId: string): Promise<Sessao | null> {
  const responsavel = await lerResponsavelPadrao(empresaId);
  if (responsavel === null) return null;
  const usuario = await lerUsuario(responsavel.id);
  if (usuario === null || !usuario.ativo || usuario.empresaId !== empresaId) return null;
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    empresaId,
    empresaPropriaId: usuario.empresaId,
    superadmin: usuario.superadmin,
    permissoes: usuario.permissoes,
  };
}

async function gerarEmpresa(empresaId: string, agora: Date, prazoMs: number): Promise<ResultadoPropostasEmpresa> {
  const base: ResultadoPropostasEmpresa = { empresaId, criadas: 0, falhas: 0 };
  const sessao = await sessaoDoResponsavel(empresaId);
  if (sessao === null) return { ...base, motivo: "sem responsável padrão ativo" };

  const cota = await restantesHoje(sessao.usuarioId, agora);
  const permitidas = cota.ilimitada ? MAXIMO_PRONTAS_POR_EMPRESA : Math.min(MAXIMO_PRONTAS_POR_EMPRESA, cota.restantes);
  if (permitidas <= 0) return { ...base, motivo: "limite diário do responsável já usado" };

  const [perfil, preferencias, propostas] = await Promise.all([
    lerEmpresa(empresaId),
    lerPreferencias(empresaId),
    listarPropostas(empresaId),
  ]);
  if (perfil === null) return { ...base, motivo: "empresa não encontrada" };
  const limites: LimitesCaixa = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const [servicos, produtos] = await Promise.all([
    obterRadar("servicos", limites, perfil),
    obterRadar("produtos", limites, perfil),
  ]);
  const comProposta = new Set(propostas.flatMap((p) => (p.compraId === null ? [] : [p.compraId])));
  const escolhidas: OportunidadeComScore[] = escolherParaProposta(
    [servicos.oportunidades, produtos.oportunidades],
    agora,
    comProposta,
    permitidas,
  );
  if (escolhidas.length === 0) return { ...base, motivo: "nenhuma oportunidade do ramo fecha nos próximos dias" };

  let seguidas = 0;
  for (const o of escolhidas) {
    if (Date.now() > prazoMs || seguidas >= MAX_FALHAS_SEGUIDAS) break;
    const r = await montarPropostaComAssistente({ cnpj: o.orgaoCnpj, ano: o.anoCompra, sequencial: o.sequencialCompra }, sessao);
    if (r.ok) {
      base.criadas += 1;
      seguidas = 0;
    } else {
      base.falhas += 1;
      seguidas += 1;
    }
  }
  return base;
}

/**
 * Para cada empresa ativa, monta no máximo 3 rascunhos de proposta (autor "assistente", em revisão para o responsável padrão)
 * das melhores oportunidades do ramo que fecham em até 5 dias e ainda não têm proposta. Custo: no máximo 3 chamadas do
 * assistente por empresa por dia, dentro do limite diário do responsável. Desligada com PROPOSTA_PRONTA_ATIVA=false. Nunca lança.
 */
export async function montarPropostasProntas(agora: Date = new Date(), prazoMs: number = Date.now() + 200_000): Promise<ResumoPropostasProntas> {
  if (!propostaProntaLigada(process.env.PROPOSTA_PRONTA_ATIVA)) return { ligado: false, empresas: [] };
  if (!assistenteDisponivel()) return { ligado: true, empresas: [] };
  const ids = await listarIdsEmpresasAtivas().catch((): string[] => []);
  const empresas: ResultadoPropostasEmpresa[] = [];
  for (const empresaId of ids) {
    if (Date.now() > prazoMs) {
      empresas.push({ empresaId, criadas: 0, falhas: 0, motivo: "sem tempo nesta rodada" });
      continue;
    }
    try {
      empresas.push(await gerarEmpresa(empresaId, agora, prazoMs));
    } catch (e) {
      console.error("[propostas-prontas]", e instanceof Error ? e.message : e);
      empresas.push({ empresaId, criadas: 0, falhas: 0, motivo: "falha ao preparar" });
    }
  }
  return { ligado: true, empresas };
}
