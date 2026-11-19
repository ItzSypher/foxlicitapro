import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import { DadosPropostaSchema } from "@/core/proposta";
import { ehTipoEvento, type EnvioValidado, type EventoProposta, type ExternaValidada, type TipoEvento } from "@/core/proposta-eventos";
import { SITUACOES_RESULTADO, type ResultadoApurado } from "@/core/proposta-resultado";
import type { DadosProposta } from "@/core/types-detalhe";
import type { StatusPropostaEquipe } from "@/core/types-equipe";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EventoNovo {
  tipo: TipoEvento;
  /** null = rotina automática */
  por: string | null;
  nota?: string | null;
  protocolo?: string | null;
  comprovante?: string | null;
  resultado?: ResultadoApurado | null;
  /** ISO 8601; padrão: agora */
  em?: string | null;
}

function jsonResultado(r: ResultadoApurado | null | undefined): postgres.JSONValue | null {
  return r ? (JSON.parse(JSON.stringify(r)) as postgres.JSONValue) : null;
}

/** Grava um evento da linha do tempo dentro de uma transação já aberta. */
export async function inserirEvento(
  tx: postgres.TransactionSql,
  empresaId: string,
  propostaId: string,
  evento: EventoNovo,
): Promise<void> {
  const dados = jsonResultado(evento.resultado);
  await tx`
    insert into proposta_eventos (empresa_id, proposta_id, tipo, por, em, nota, protocolo, comprovante, dados)
    values (${empresaId}, ${propostaId}, ${evento.tipo}, ${evento.por}, coalesce(${evento.em ?? null}::timestamptz, now()),
            ${evento.nota ?? null}, ${evento.protocolo ?? null}, ${evento.comprovante ?? null}, ${dados === null ? null : tx.json(dados)})
  `;
}

const resultadoSchema: z.ZodType<ResultadoApurado> = z.object({
  situacao: z.enum(SITUACOES_RESULTADO),
  vencedor: z.string().nullable(),
  valor: z.number().nullable(),
  itensGanhos: z.number(),
  itensPerdidos: z.number(),
  itensAguardando: z.number(),
});

interface LinhaEvento {
  id: string;
  tipo: string;
  por_nome: string | null;
  em: Date;
  nota: string | null;
  protocolo: string | null;
  tem_comprovante: boolean;
  dados: unknown;
}

/** Linha do tempo da proposta, mais antigo primeiro. O comprovante não vem junto: só a marca de que existe. */
export async function listarEventos(empresaId: string, propostaId: string): Promise<EventoProposta[]> {
  if (!FORMATO_ID.test(propostaId)) return [];
  const linhas = await sql<LinhaEvento[]>`
    select e.id, e.tipo, u.nome as por_nome, e.em, e.nota, e.protocolo, (e.comprovante is not null) as tem_comprovante, e.dados
    from proposta_eventos e
    left join usuarios u on u.id = e.por
    where e.empresa_id = ${empresaId} and e.proposta_id = ${propostaId}
    order by e.em, e.id
    limit 200
  `;
  const eventos: EventoProposta[] = [];
  for (const l of linhas) {
    if (!ehTipoEvento(l.tipo)) continue;
    const resultado = l.dados === null ? null : resultadoSchema.safeParse(l.dados);
    eventos.push({
      id: l.id,
      tipo: l.tipo,
      porNome: l.por_nome,
      em: l.em.toISOString(),
      nota: l.nota,
      protocolo: l.protocolo,
      temComprovante: l.tem_comprovante,
      resultado: resultado?.success ? resultado.data : null,
    });
  }
  return eventos;
}

/** Data URL do comprovante de um evento da proposta; null se não existe ou é de outra empresa. */
export async function lerComprovanteEvento(empresaId: string, propostaId: string, eventoId: string): Promise<string | null> {
  if (!FORMATO_ID.test(propostaId) || !FORMATO_ID.test(eventoId)) return null;
  const [linha] = await sql<{ comprovante: string | null }[]>`
    select comprovante from proposta_eventos
    where empresa_id = ${empresaId} and proposta_id = ${propostaId} and id = ${eventoId}
  `;
  return linha?.comprovante ?? null;
}

/**
 * Marca como enviada com a prova do envio. Só muda se o status atual for um dos `permitidos`
 * (evita marcar uma proposta que voltou para rascunho enquanto a folha estava aberta).
 * Um novo envio da mesma proposta (reenvio) só acrescenta outro evento.
 */
export async function marcarEnviada(
  empresaId: string,
  id: string,
  por: string,
  envio: EnvioValidado,
  permitidos: ReadonlyArray<StatusPropostaEquipe>,
): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  return sql.begin(async (tx) => {
    const linhas = await tx<{ id: string }[]>`
      update propostas
      set status = 'enviada', enviada_em = coalesce(enviada_em, now()), enviada_por = coalesce(enviada_por, ${por}), atualizado_em = now()
      where empresa_id = ${empresaId} and id = ${id} and status in ${tx([...permitidos])}
      returning id
    `;
    if (linhas.length === 0) return false;
    await inserirEvento(tx, empresaId, id, { tipo: "enviada", por, ...envio });
    return true;
  });
}

/**
 * Proposta enviada fora do sistema: entra já como enviada, sem itens, com o valor informado.
 * Liga ao item do Pipeline quando o número é do PNCP e a compra está lá.
 */
export async function criarPropostaExterna(
  empresaId: string,
  por: string,
  externa: ExternaValidada,
  dados: DadosProposta,
  titulo: string,
): Promise<string> {
  const dadosLidos = DadosPropostaSchema.parse(dados);
  const enviadaEm = externa.enviadaEm === null ? null : `${externa.enviadaEm}T12:00:00-03:00`;
  return sql.begin(async (tx) => {
    const [linha] = await tx<{ id: string }[]>`
      insert into propostas (empresa_id, compra_id, pipeline_id, modelo, titulo, dados, total, criado_por, autor, status,
                             externa, portal, enviada_em, enviada_por)
      values (
        ${empresaId},
        ${externa.compraId},
        (select id from pipeline_itens where empresa_id = ${empresaId} and id = ${externa.compraId}),
        'cotacao-simples',
        ${titulo},
        ${tx.json(dadosLidos)},
        ${(externa.valorCentavos / 100).toFixed(2)},
        ${por},
        'usuario',
        'enviada',
        true,
        ${externa.portal},
        coalesce(${enviadaEm}::timestamptz, now()),
        ${por}
      )
      returning id
    `;
    if (!linha) throw new Error("A proposta não foi gravada");
    await inserirEvento(tx, empresaId, linha.id, {
      tipo: "enviada",
      por,
      em: enviadaEm,
      nota: externa.nota,
      protocolo: externa.protocolo,
      comprovante: externa.comprovante,
    });
    // Registro de hoje de um envio que pode ter sido antes: a criação fica na data em que foi registrada.
    await inserirEvento(tx, empresaId, linha.id, { tipo: "criada", por, nota: `Registrada depois de enviada pelo portal ${externa.portal}.` });
    return linha.id;
  });
}

/* ---------- resultado automático ---------- */

export interface PropostaSemResultado {
  id: string;
  empresaId: string;
  cnpjEmpresa: string;
  compraId: string;
  titulo: string;
  numerosItens: number[];
  /** ISO 8601 */
  enviadaEm: string | null;
  consultadoEm: string | null;
  pipelineId: string | null;
}

interface LinhaSemResultado {
  id: string;
  empresa_id: string;
  cnpj: string;
  compra_id: string;
  titulo: string;
  dados: unknown;
  enviada_em: Date | null;
  resultado_consultado_em: Date | null;
  pipeline_id: string | null;
}

const itensSchema = z.object({ itens: z.array(z.object({ numero: z.number().int() })) });

/**
 * Enviadas sem resultado final, com compra do PNCP, de empresas ativas, enviadas nos últimos 180 dias
 * e não consultadas nas últimas 20 h. As mais antigas sem consulta primeiro.
 */
export async function listarPropostasSemResultado(limite: number): Promise<PropostaSemResultado[]> {
  const n = Math.max(1, Math.min(200, Math.trunc(limite)));
  const linhas = await sql<LinhaSemResultado[]>`
    select p.id, p.empresa_id, e.cnpj, p.compra_id, p.titulo, p.dados, coalesce(p.enviada_em, p.atualizado_em) as enviada_em,
           p.resultado_consultado_em, p.pipeline_id
    from propostas p
    join empresas e on e.id = p.empresa_id and e.ativa
    where p.status = 'enviada' and p.compra_id is not null
      and (p.resultado is null or p.resultado = 'aguardando')
      and coalesce(p.enviada_em, p.atualizado_em) > now() - interval '180 days'
      and (p.resultado_consultado_em is null or p.resultado_consultado_em < now() - interval '20 hours')
    order by p.resultado_consultado_em nulls first, p.enviada_em
    limit ${n}
  `;
  return linhas.map((l) => {
    const itens = itensSchema.safeParse(l.dados);
    return {
      id: l.id,
      empresaId: l.empresa_id,
      cnpjEmpresa: l.cnpj,
      compraId: l.compra_id,
      titulo: l.titulo,
      numerosItens: itens.success ? itens.data.itens.map((i) => i.numero) : [],
      enviadaEm: l.enviada_em ? l.enviada_em.toISOString() : null,
      consultadoEm: l.resultado_consultado_em ? l.resultado_consultado_em.toISOString() : null,
      pipelineId: l.pipeline_id,
    };
  });
}

/** Só marca a hora da consulta (o PNCP falhou ou não há o que mudar). */
export async function marcarConsultaResultado(empresaId: string, id: string): Promise<void> {
  await sql`update propostas set resultado_consultado_em = now() where empresa_id = ${empresaId} and id = ${id}`;
}

/**
 * Grava o resultado apurado. Ao sair o resultado final: evento na linha do tempo e, se ganhou,
 * o valor homologado no item do Pipeline (só quando ainda não foi preenchido à mão).
 * Devolve true quando o resultado final acabou de ser gravado (para o aviso sair uma vez só).
 */
export async function gravarResultado(empresaId: string, id: string, apurado: ResultadoApurado): Promise<boolean> {
  const final = apurado.situacao !== "aguardando";
  const valor = apurado.valor === null ? null : apurado.valor.toFixed(2);
  return sql.begin(async (tx) => {
    const linhas = await tx<{ pipeline_id: string | null }[]>`
      update propostas
      set resultado = ${apurado.situacao}, resultado_vencedor = ${apurado.vencedor}, resultado_valor = ${valor},
          resultado_consultado_em = now(), resultado_em = ${final ? tx`now()` : null}
      where empresa_id = ${empresaId} and id = ${id} and status = 'enviada' and (resultado is null or resultado = 'aguardando')
      returning pipeline_id
    `;
    const linha = linhas[0];
    if (!linha || !final) return false;
    await inserirEvento(tx, empresaId, id, { tipo: "resultado", por: null, resultado: apurado });
    if (apurado.situacao === "ganhou" && linha.pipeline_id !== null && valor !== null) {
      await tx`
        update pipeline_itens set valor_homologado = coalesce(valor_homologado, ${valor})
        where empresa_id = ${empresaId} and id = ${linha.pipeline_id}
      `;
    }
    return true;
  });
}
