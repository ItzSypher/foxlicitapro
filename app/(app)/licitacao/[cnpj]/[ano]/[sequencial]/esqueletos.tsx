import { Fragment, type ReactNode } from "react";
import { EsqueletoNumeros } from "@/components/licitacao/numeros";
import { ChipsSecoes, IndiceSecoes } from "@/components/licitacao/navegacao-secoes";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Esqueletos da página da licitação: mesma forma da seção que vai ocupar o lugar.
 * Ficam num arquivo sem acesso a dados para o loading.tsx (a primeira pintura) ser leve.
 */

export function EsqueletoTopo() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-11 w-20" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-full max-w-xl" />
        <Skeleton className="h-6 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-3 md:gap-0 md:p-0">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 md:p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-36" />
      </div>
    </div>
  );
}

/** Seção que chega recolhida: só a barra do título e um selo. */
export function EsqueletoRecolhida({ id, titulo }: { id: string; titulo: string }) {
  return (
    <section
      id={id}
      aria-label={`${titulo} (carregando)`}
      aria-busy="true"
      className="flex min-h-11 flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3"
    >
      <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
      <Skeleton className="h-5 w-24 rounded-full" />
    </section>
  );
}

export function EsqueletoSecao({ id, titulo, linhas = 3 }: { id: string; titulo: string; linhas?: number }) {
  return (
    <section id={id} aria-label={`${titulo} (carregando)`} aria-busy="true" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Seções abaixo dos números, na ordem da página: id, título e como o esqueleto se parece. */
const SECOES_ABAIXO: ReadonlyArray<{ id: string; titulo: string; linhas: number | null }> = [
  { id: "datas", titulo: "Datas", linhas: 2 },
  { id: "preco-sugerido", titulo: "Preço sugerido", linhas: 3 },
  { id: "caixa", titulo: "Caminho do dinheiro", linhas: 4 },
  { id: "ficha", titulo: "Ficha do edital", linhas: 4 },
  { id: "itens", titulo: "Itens", linhas: 5 },
  { id: "arquivos", titulo: "Arquivos", linhas: 3 },
  { id: "acervo", titulo: "Do seu acervo", linhas: 2 },
  { id: "concorrentes", titulo: "Concorrentes", linhas: null },
  { id: "semelhantes", titulo: "Semelhantes", linhas: null },
  { id: "resumo", titulo: "Resumo", linhas: null },
  { id: "sinais", titulo: "Sinais para o seu perfil", linhas: null },
  { id: "texto", titulo: "Texto do edital", linhas: null },
  { id: "nota", titulo: "Por que essa nota", linhas: null },
];

/** Esqueleto de uma seção pelo id (o mesmo que a página usa de `fallback` e o loading.tsx usa na primeira pintura). */
export function esqueletoDaSecao(id: string): ReactNode {
  const secao = SECOES_ABAIXO.find((s) => s.id === id);
  if (!secao) return null;
  return secao.linhas === null ? (
    <EsqueletoRecolhida id={secao.id} titulo={secao.titulo} />
  ) : (
    <EsqueletoSecao id={secao.id} titulo={secao.titulo} linhas={secao.linhas} />
  );
}

/** A página inteira em esqueleto, com a mesma estrutura da página pronta: nada pula quando o conteúdo chega. */
export function EsqueletoPagina() {
  return (
    <div className="flex min-w-0 flex-col gap-4 pb-20 lg:pb-0" aria-busy="true">
      <EsqueletoTopo />
      <EsqueletoNumeros />
      <ChipsSecoes />
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_160px] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          {SECOES_ABAIXO.map((s) => (
            <Fragment key={s.id}>{esqueletoDaSecao(s.id)}</Fragment>
          ))}
        </div>
        <IndiceSecoes />
      </div>
    </div>
  );
}
