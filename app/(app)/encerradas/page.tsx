import { connection } from "next/server";
import Link from "next/link";
import { listarPipeline } from "@/db/pipeline";
import { maisRecentesPrimeiro, separarEncerrados, textoEncerrou } from "@/core/encerradas";
import { resumirObjeto } from "@/core/objeto";
import { temPermissao } from "@/core/permissoes";
import { exigirSessao } from "@/lib/sessao";
import { ListaEncerradas, type ItemEncerrado } from "@/components/encerradas/lista-encerradas";
import {
  REGIOES_PIPELINE,
  ROTULO_ETAPA,
  ROTULO_REGIAO,
  contarPorRegiao,
  ehFiltroRegiao,
  filtrarPorRegiao,
  type FiltroRegiaoPipeline,
  type ItemPipeline,
} from "@/components/pipeline/tipos";
import { cn } from "@/lib/utils";

const OPCOES_REGIAO: ReadonlyArray<{ id: FiltroRegiaoPipeline; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  ...REGIOES_PIPELINE.map((r) => ({ id: r, rotulo: ROTULO_REGIAO[r] })),
];

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
    regiao: item.regiao,
    valorEstimado: item.valorEstimado,
    etapaRotulo: ROTULO_ETAPA[i.etapa],
    encerrouTexto: textoEncerrou(item.dataEncerramento, agora),
    responsavelNome: i.responsavelNome,
    href: `/licitacao/${item.orgaoCnpj}/${item.anoCompra}/${item.sequencialCompra}`,
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
  const regiaoBruta = Array.isArray(params.regiao) ? params.regiao[0] : params.regiao;
  const regiao: FiltroRegiaoPipeline = ehFiltroRegiao(regiaoBruta) ? regiaoBruta : "todas";

  let itens: ItemPipeline[] | null;
  try {
    itens = await listarPipeline(sessao.empresaId);
  } catch (e) {
    console.error("[encerradas] leitura falhou:", e instanceof Error ? e.message : e);
    itens = null;
  }

  const agora = momento();
  const encerradas =
    itens === null
      ? []
      : separarEncerrados(itens, (i) => ({ etapa: i.etapa, dataEncerramento: i.item.dataEncerramento }), agora).encerrados;
  const contagem = contarPorRegiao(encerradas);
  const lista = maisRecentesPrimeiro(filtrarPorRegiao(encerradas, regiao), (i) => i.item.dataEncerramento).map((i) =>
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
            <nav aria-label="Região" className="sem-barra flex min-w-0 items-center gap-2 overflow-x-auto">
              {OPCOES_REGIAO.map((o) => {
                const ativa = regiao === o.id;
                return (
                  <Link
                    key={o.id}
                    href={o.id === "todas" ? "/encerradas" : `/encerradas?regiao=${o.id}`}
                    aria-current={ativa ? "true" : undefined}
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-9",
                      ativa
                        ? "border-control bg-active font-medium text-ink"
                        : "border-border bg-surface text-muted-foreground hover:bg-raised hover:text-ink",
                    )}
                  >
                    {o.rotulo}
                    <span className="font-mono text-xs tabular-nums">{contagem[o.id]}</span>
                  </Link>
                );
              })}
            </nav>
          )}
          <ListaEncerradas itens={lista} podeEditar={temPermissao(sessao, "mover_pipeline")} />
        </>
      )}
    </div>
  );
}
