import { connection } from "next/server";
import { listarPipeline } from "@/db/pipeline";
import { maisRecentesPrimeiro, separarEncerrados, textoEncerrou } from "@/core/encerradas";
import { linkInternoDaOportunidade } from "@/core/link-oportunidade";
import { resumirObjeto } from "@/core/objeto";
import { temPermissao } from "@/core/permissoes";
import { ufsDasAreasAtuais } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";
import { ListaEncerradas, type ItemEncerrado } from "@/components/encerradas/lista-encerradas";
import {
  ROTULO_ETAPA,
  TODAS_AS_UFS,
  contarPorUf,
  filtrarPorUf,
  lerFiltroUf,
  ufsDoFiltro,
  type ItemPipeline,
} from "@/components/pipeline/tipos";
import { Segmentado } from "@/components/ui/segmentado";

/** Instante do pedido, lido fora do render. */
function momento(): number {
  return Date.now();
}

function paraItem(i: ItemPipeline, agora: number): ItemEncerrado {
  const { item } = i;
  return {
    id: i.id,
    titulo: resumirObjeto(item.objeto),
    orgao: item.orgao,
    municipio: item.municipio,
    uf: item.uf,
    valorEstimado: item.valorEstimado,
    etapaRotulo: ROTULO_ETAPA[i.etapa],
    encerrouTexto: textoEncerrou(item.dataEncerramento, agora),
    responsavelNome: i.responsavelNome,
    link: linkInternoDaOportunidade(item),
  };
}

export default async function EncerradasPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  await connection();
  const sessao = await exigirSessao();
  const params = await searchParams;
  const ufBruta = Array.isArray(params.uf) ? params.uf[0] : params.uf;
  const uf = lerFiltroUf(ufBruta);

  let itens: ItemPipeline[] | null;
  try {
    itens = await listarPipeline(sessao.empresaId);
  } catch (e) {
    console.error("[encerradas] leitura falhou:", e instanceof Error ? e.message : e);
    itens = null;
  }

  const agora = momento();
  const ufsDasAreas = await ufsDasAreasAtuais("encerradas");
  const encerradas =
    itens === null
      ? []
      : separarEncerrados(itens, (i) => ({ etapa: i.etapa, dataEncerramento: i.item.dataEncerramento }), agora).encerrados;
  const contagem = contarPorUf(encerradas);
  const opcoesUf = [
    { valor: TODAS_AS_UFS, rotulo: "Todas" },
    ...ufsDoFiltro(ufsDasAreas, encerradas).map((u) => ({ valor: u, rotulo: u })),
  ];
  const lista = maisRecentesPrimeiro(filtrarPorUf(encerradas, uf), (i) => i.item.dataEncerramento).map((i) =>
    paraItem(i, agora),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-4 lg:gap-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Encerradas</h1>
        <p className="text-sm text-muted-foreground">
          Licitações que passaram do prazo antes de chegar à disputa. Se a proposta foi enviada a tempo, mova para Em disputa.
        </p>
      </div>

      {itens === null ? (
        <p role="alert" className="rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-ink">
          Não foi possível carregar as licitações encerradas agora. Recarregue a página.
        </p>
      ) : (
        <>
          {encerradas.length === 0 ? null : (
            <Segmentado
              rotulo="Estado"
              valor={uf}
              opcoes={opcoesUf.map((o) => ({
                valor: o.valor,
                rotulo: o.rotulo,
                contagem: contagem[o.valor] ?? 0,
                href: o.valor === TODAS_AS_UFS ? "/encerradas" : `/encerradas?uf=${o.valor}`,
              }))}
              rolavel
            />
          )}
          <ListaEncerradas itens={lista} podeEditar={temPermissao(sessao, "mover_pipeline")} />
        </>
      )}
    </div>
  );
}
