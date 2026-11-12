import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Editor } from "@/components/propostas/editor";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { chaveDeNumeroControle, referenciasDoDetalhe } from "@/core/proposta";
import { listarCotacoes } from "@/db/cotacoes";
import { lerProposta, type Proposta } from "@/db/propostas";
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

async function lerCotacao(compraId: string | null): Promise<{ precoMinimo: number; precoAlvo: number } | null> {
  if (compraId === null) return null;
  try {
    const [ultima] = await listarCotacoes(compraId, 1);
    return ultima ? { precoMinimo: ultima.precoMinimo, precoAlvo: ultima.precoAlvo } : null;
  } catch {
    return null;
  }
}

function linkVigente(p: Proposta): { token: string; expira: string } | null {
  if (!p.tokenPublico || !p.tokenExpira) return null;
  return Date.parse(p.tokenExpira) > Date.now() ? { token: p.tokenPublico, expira: p.tokenExpira } : null;
}

export default async function PropostaPage({ params, searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const proposta = await lerProposta(id);
  if (!proposta) notFound();

  const [referencias, cotacao] = await Promise.all([lerReferencias(proposta.compraId), lerCotacao(proposta.compraId)]);
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
      }}
      usuarioId={sessao.usuarioId}
      referencias={referencias}
      cotacao={cotacao}
      avisoSemItens={avisoBruto === "itens"}
    />
  );
}
