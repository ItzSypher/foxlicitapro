import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Editor } from "@/components/propostas/editor";
import { PropostaExterna } from "@/components/propostas/proposta-externa";
import { linhaDoTempo, type EventoProposta } from "@/core/proposta-eventos";
import { listarEventos } from "@/db/proposta-eventos";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { chaveDeNumeroControle, referenciasDoDetalhe } from "@/core/proposta";
import { listarCotacoes } from "@/db/cotacoes";
import { lerAssinatura } from "@/db/empresas";
import { lerProposta, type Proposta } from "@/db/propostas";
import { podeAgirNaRevisao } from "@/core/permissoes";
import { emitenteDoPerfil } from "@/core/proposta-emitente";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Proposta · FoxLicita Pro" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string | string[] }>;
}

async function lerReferencias(compraId: string | null): Promise<Record<number, number>> {
  const chave = compraId === null ? null : chaveDeNumeroControle(compraId);
  if (!chave) return {};
  try {
    const detalhe = await buscarDetalheCompra(chave);
    return detalhe ? referenciasDoDetalhe(detalhe) : {};
  } catch {
    return {};
  }
}

async function lerCotacao(empresaId: string, compraId: string | null): Promise<{ precoMinimo: number; precoAlvo: number } | null> {
  if (compraId === null) return null;
  try {
    const [ultima] = await listarCotacoes(empresaId, compraId, 1);
    return ultima ? { precoMinimo: ultima.precoMinimo, precoAlvo: ultima.precoAlvo } : null;
  } catch {
    return null;
  }
}

async function lerLinhaDoTempo(empresaId: string, p: Proposta): Promise<EventoProposta[]> {
  let eventos: EventoProposta[] = [];
  try {
    eventos = await listarEventos(empresaId, p.id);
  } catch (e) {
    console.error("[propostas] linha do tempo:", e instanceof Error ? e.message : e);
  }
  return linhaDoTempo(eventos, { criadoEm: p.criadoEm, criadoPorNome: p.criadoPorNome, autor: p.autor });
}

function linkVigente(p: Proposta): { token: string; expira: string } | null {
  if (!p.tokenPublico || !p.tokenExpira) return null;
  return Date.parse(p.tokenExpira) > Date.now() ? { token: p.tokenPublico, expira: p.tokenExpira } : null;
}

export default async function PropostaPage({ params, searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const proposta = await lerProposta(sessao.empresaId, id);
  if (!proposta) notFound();

  const resultado = {
    resultado: proposta.resultado,
    vencedor: proposta.resultadoVencedor,
    valor: proposta.resultadoValor,
    temCompraPncp: proposta.compraId !== null && chaveDeNumeroControle(proposta.compraId) !== null,
  };

  if (proposta.externa) {
    return (
      <PropostaExterna
        key={proposta.id}
        proposta={{
          id: proposta.id,
          titulo: proposta.titulo,
          orgao: proposta.dados.orgao,
          numero: proposta.dados.numeroCompra,
          objeto: proposta.dados.objeto,
          portal: proposta.portal,
          total: proposta.total,
          enviadaEm: proposta.enviadaEm,
          criadoPorNome: proposta.criadoPorNome,
          resultado,
        }}
        eventos={await lerLinhaDoTempo(sessao.empresaId, proposta)}
        podeEditar={podeAgirNaRevisao(sessao, "enviar")}
      />
    );
  }

  const [referencias, cotacao, perfil, eventos] = await Promise.all([
    lerReferencias(proposta.compraId),
    lerCotacao(sessao.empresaId, proposta.compraId),
    perfilAtual(),
    lerLinhaDoTempo(sessao.empresaId, proposta),
  ]);
  const avisoBruto = Array.isArray(aviso) ? aviso[0] : aviso;

  return (
    <Editor
      key={proposta.id}
      proposta={{
        id: proposta.id,
        titulo: proposta.titulo,
        modelo: proposta.modelo,
        dados: proposta.dados,
        status: proposta.status,
        link: linkVigente(proposta),
        autor: proposta.autor,
        criadoPor: proposta.criadoPor,
        criadoPorNome: proposta.criadoPorNome,
        revisadoPorNome: proposta.revisadoPorNome,
        revisaoNota: proposta.revisaoNota,
        revisadoEm: proposta.revisadoEm,
        analise: proposta.analise,
        enviadaEm: proposta.enviadaEm,
        resultado,
      }}
      eventos={eventos}
      usuarioId={sessao.usuarioId}
      referencias={referencias}
      cotacao={cotacao}
      avisoSemItens={avisoBruto === "itens"}
      emitente={emitenteDoPerfil({ ...perfil, assinatura: await lerAssinatura(perfil.id) })}
      acessos={{
        editar: podeAgirNaRevisao(sessao, "enviar"),
        aprovar: podeAgirNaRevisao(sessao, "aprovar"),
        devolver: podeAgirNaRevisao(sessao, "devolver"),
      }}
    />
  );
}
