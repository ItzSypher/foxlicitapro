import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import { ListaItensConselheiro, type ItemDaLista } from "@/components/conselheiro/lista-itens";
import { PainelItemConselheiro, type CabecalhoItem } from "@/components/conselheiro/painel-item";
import { ETAPAS_ATIVAS, type ItemPipeline } from "@/components/pipeline/tipos";
import type { AmostraConcorrente } from "@/core/concorrentes";
import { separarEncerrados } from "@/core/encerradas";
import type { PrecoFornecedor } from "@/core/fornecedores";
import { linkInternoDaOportunidade } from "@/core/link-oportunidade";
import { resumirObjeto } from "@/core/objeto";
import { ROTULO_REGIAO } from "@/core/perfil";
import { temPermissao } from "@/core/permissoes";
import type { PrecoSugerido } from "@/core/preco-sugerido";
import { lerAmostrasEmCache } from "@/db/concorrentes";
import { lerUltimaAnalise, resumirAnalisesPorItem, type ResumoAnalise } from "@/db/conselheiro";
import { listarPrecosRecentes } from "@/db/fornecedores";
import { listarPipeline } from "@/db/pipeline";
import { perfilAtual, ufsDasAreasAtuais } from "@/lib/empresa-atual";
import { assistenteDisponivel } from "@/lib/gemini";
import type { AnaliseSalva } from "@/lib/conselheiro/esquema";
import { precoDoItemPipeline } from "@/lib/conselheiro/preco";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Conselheiro · FoxLicita Pro" };

/** A análise espera a resposta do assistente (até 60 s) dentro desta rota. */
export const maxDuration = 120;

/** Instante do pedido, lido uma vez para separar os itens encerrados. */
function momento(): number {
  return Date.now();
}

interface Props {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}

async function precoDoItem(empresaId: string, item: ItemPipeline): Promise<PrecoSugerido | null> {
  try {
    const [perfil, amostras, precos] = await Promise.all([
      perfilAtual(),
      lerAmostrasEmCache().catch((): AmostraConcorrente[] => []),
      listarPrecosRecentes(empresaId).catch((): PrecoFornecedor[] => []),
    ]);
    return precoDoItemPipeline(item, perfil.porte, amostras, precos);
  } catch (e) {
    console.error("[conselheiro] preço sugerido indisponível:", e instanceof Error ? e.message : e);
    return null;
  }
}

export default async function ConselheiroPage({ searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const params = await searchParams;
  const bruto = Array.isArray(params.item) ? params.item[0] : params.item;
  const itemId = (bruto ?? "").trim().slice(0, 200);

  let pipeline: ItemPipeline[] | null;
  try {
    pipeline = await listarPipeline(sessao.empresaId);
  } catch (e) {
    console.error("[conselheiro] leitura do pipeline falhou:", e instanceof Error ? e.message : e);
    pipeline = null;
  }

  const ativos =
    pipeline === null
      ? []
      : separarEncerrados(pipeline, (i) => ({ etapa: i.etapa, dataEncerramento: i.item.dataEncerramento }), momento()).abertos.filter((i) =>
          ETAPAS_ATIVAS.includes(i.etapa),
        );

  const [resumos, ufsDasAreas]: [Map<string, ResumoAnalise>, string[]] = await Promise.all([
    resumirAnalisesPorItem(sessao.empresaId).catch(() => new Map<string, ResumoAnalise>()),
    ufsDasAreasAtuais("conselheiro"),
  ]);
  const lista: ItemDaLista[] = ativos.map((i) => ({
    id: i.id,
    titulo: resumirObjeto(i.item.objeto) || "Contratação sem objeto informado",
    orgao: i.item.orgao,
    municipio: i.item.municipio,
    uf: i.item.uf,
    valorEstimado: i.item.valorEstimado,
    etapa: i.etapa,
    veredito: resumos.get(i.id)?.veredito ?? null,
  }));

  const escolhido = itemId === "" ? undefined : ativos.find((i) => i.id === itemId);
  let preco: PrecoSugerido | null = null;
  let analise: AnaliseSalva | null = null;
  if (escolhido) {
    [preco, analise] = await Promise.all([
      precoDoItem(sessao.empresaId, escolhido),
      lerUltimaAnalise(sessao.empresaId, escolhido.id).catch((e: unknown): AnaliseSalva | null => {
        console.error("[conselheiro] leitura da análise falhou:", e instanceof Error ? e.message : e);
        return null;
      }),
    ]);
  }

  const cabecalho: CabecalhoItem | null = escolhido
    ? {
        id: escolhido.id,
        titulo: resumirObjeto(escolhido.item.objeto) || "Contratação sem objeto informado",
        orgao: escolhido.item.orgao,
        local: `${escolhido.item.municipio}/${escolhido.item.uf}`,
        regiao: ROTULO_REGIAO[escolhido.item.regiao],
        modalidade: escolhido.item.modalidadeNome,
        valorEstimado: escolhido.item.valorEstimado,
        encerramento: escolhido.item.dataEncerramento,
        etapa: escolhido.etapa,
        linkLicitacao: linkInternoDaOportunidade(escolhido.item),
      }
    : null;

  const temSelecao = itemId !== "";
  const podeAnalisar = temPermissao(sessao, "mover_pipeline") || temPermissao(sessao, "revisao_juridica");

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="flex items-center gap-2 text-[22px] leading-tight font-semibold text-ink">
          <Sparkles aria-hidden="true" className="size-5 shrink-0 text-brand" />
          Conselheiro
        </h1>
        <p className="text-sm text-muted-foreground">
          Diz se vale a pena, como conseguir o produto ou serviço e explica o preço sugerido, para o gestor e o jurídico decidirem.
        </p>
      </header>

      {pipeline === null ? (
        <p role="alert" className="rounded-card border border-border px-4 py-5 text-sm text-negative">
          Não foi possível carregar o Pipeline agora. Tente de novo em instantes.
        </p>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          <ListaItensConselheiro
            itens={lista}
            ufsDasAreas={ufsDasAreas}
            selecionado={escolhido?.id ?? null}
            className={temSelecao ? "hidden lg:flex" : "flex"}
          />

          <div className={temSelecao ? "flex min-w-0 flex-col gap-4" : "hidden min-w-0 lg:flex"}>
            {temSelecao ? (
              <Link
                href="/conselheiro"
                className="inline-flex h-11 w-fit items-center gap-1 rounded-control pr-3 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Voltar para a lista
              </Link>
            ) : null}

            {cabecalho !== null ? (
              <PainelItemConselheiro
                key={cabecalho.id}
                item={cabecalho}
                preco={preco}
                analiseInicial={analise}
                disponivel={assistenteDisponivel()}
                podeAnalisar={podeAnalisar}
              />
            ) : temSelecao ? (
              <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">
                Este item não está entre os ativos do Pipeline (pode ter encerrado ou saído). Escolha outro na lista.
              </p>
            ) : (
              <p className="rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-muted-foreground">
                Escolha um item da lista para ver o preço sugerido e pedir a opinião do conselheiro.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
