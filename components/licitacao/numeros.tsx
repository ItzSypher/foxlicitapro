import type { ComponentProps } from "react";
import Link from "next/link";
import { Calculator, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { NOME_NIVEL_CAIXA, type NivelCaixa } from "@/core/caminho-dinheiro";
import type { ContaLucro } from "@/core/lucro";
import { BlocoSoftware } from "@/components/licitacao/software";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarMoeda, formatarMoedaCurta } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Props {
  valorEstimado: number | null;
  /** Preço sugerido pelas regras; null sem custo para calcular */
  precoAlvo: number | null;
  /** Caixa a pôr do bolso antes de receber e o nível dele */
  caixa: { valor: number | null; nivel: NivelCaixa };
  /** Dias entre entregar e receber; 0 com pagamento antecipado; null sem prazo */
  diasSemReceber: number | null;
  /** Só o dono vê a conta; null para os demais papéis ou sem receita para calcular */
  lucro: ContaLucro | null;
  /** O que entrou como receita da conta */
  receitaDe: "alvo" | "estimado";
  /** Calculadora já com o item aberto */
  linkCalculadora: string;
  /** Objeto de site, sistema ou software: dados do bloco de terceirização; null nos demais objetos */
  software: ComponentProps<typeof BlocoSoftware> | null;
}

const TOM_NIVEL: Record<NivelCaixa, TomPilula> = { baixo: "positivo", medio: "neutro", alto: "aviso" };

function Celula({ rotulo, children, selo }: { rotulo: string; children: React.ReactNode; selo?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-surface p-3 sm:p-4">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="flex min-w-0 flex-col items-start gap-1">
        <span className="text-xl leading-tight font-semibold tabular-nums wrap-break-word text-ink sm:text-2xl">{children}</span>
        {selo}
      </dd>
    </div>
  );
}

function Vazio({ texto = "—" }: { texto?: string }) {
  return <span className="text-faint">{texto}</span>;
}

function textoDias(dias: number | null): React.ReactNode {
  if (dias === null) return <Vazio />;
  if (dias === 0) return "Recebe antes";
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function Linha({ rotulo, children, selo }: { rotulo: string; children: React.ReactNode; selo?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {rotulo}
        {selo}
      </dt>
      <dd className="text-sm font-medium tabular-nums whitespace-nowrap text-ink">{children}</dd>
    </div>
  );
}

function Resultado({ lucro, receitaDe }: { lucro: ContaLucro; receitaDe: "alvo" | "estimado" }) {
  const prejuizo = lucro.situacao === "prejuizo";
  const empate = lucro.situacao === "empate";
  const Icone = prejuizo ? TrendingDown : TrendingUp;
  const cor = prejuizo ? "text-negative" : empate ? "text-ink" : "text-positive";
  const comissao = lucro.comissaoPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <div className="flex flex-col gap-2 border-t border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={cn("flex items-center gap-1.5 text-sm font-semibold", cor)}>
          <Icone aria-hidden="true" className="size-4" />
          {prejuizo ? "Prejuízo" : empate ? "Sem lucro nem prejuízo" : "Lucro"}
        </p>
        <p className={cn("text-2xl leading-tight font-semibold tabular-nums", cor)}>
          {formatarMoeda(lucro.resultado)}
          <span className="ml-2 text-sm font-medium">{lucro.margemPercentual.toLocaleString("pt-BR")}%</span>
        </p>
      </div>
      <dl className="flex flex-col divide-y divide-border">
        <Linha rotulo={receitaDe === "alvo" ? "Receita no preço alvo" : "Receita no valor estimado"}>{formatarMoeda(lucro.receita)}</Linha>
        <Linha rotulo="Custo" selo={lucro.custoEstimado ? <Pilula tom="aviso">estimado</Pilula> : null}>
          <span className="inline-flex items-center gap-1">
            <Minus aria-hidden="true" className="size-3 text-muted-foreground" />
            {formatarMoeda(lucro.custo)}
          </span>
        </Linha>
        <Linha rotulo={`Comissão ${comissao}%`}>
          <span className="inline-flex items-center gap-1">
            <Minus aria-hidden="true" className="size-3 text-muted-foreground" />
            {formatarMoeda(lucro.comissao)}
          </span>
        </Linha>
        <Linha rotulo="Preço mínimo sem prejuízo">{formatarMoeda(lucro.precoMinimo)}</Linha>
      </dl>
    </div>
  );
}

/** Os números da licitação logo no topo: valor, preço alvo, caixa, prazo sem receber e, para o dono, lucro ou prejuízo. */
export function NumerosLicitacao({ valorEstimado, precoAlvo, caixa, diasSemReceber, lucro, receitaDe, linkCalculadora, software }: Props) {
  return (
    <section
      id="numeros"
      aria-labelledby="numeros-titulo"
      className="scroll-mt-[calc(52px+3.5rem)] overflow-hidden rounded-card border border-border bg-surface lg:scroll-mt-16"
    >
      <h2 id="numeros-titulo" className="sr-only">
        Números
      </h2>
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <Celula rotulo="Valor estimado">{valorEstimado === null ? <Vazio texto="Sigiloso" /> : formatarMoedaCurta(valorEstimado)}</Celula>
        <Celula rotulo="Preço alvo">{precoAlvo === null ? <Vazio /> : formatarMoedaCurta(precoAlvo)}</Celula>
        <Celula
          rotulo="Caixa necessário"
          selo={<Pilula tom={TOM_NIVEL[caixa.nivel]}>{`Caixa ${NOME_NIVEL_CAIXA[caixa.nivel]}`}</Pilula>}
        >
          {caixa.valor === null ? <Vazio texto="Sigiloso" /> : `~${formatarMoedaCurta(caixa.valor)}`}
        </Celula>
        <Celula rotulo="Dias sem receber">{textoDias(diasSemReceber)}</Celula>
      </dl>
      {lucro ? <Resultado lucro={lucro} receitaDe={receitaDe} /> : null}
      {software ? <BlocoSoftware {...software} /> : null}
      <div className="border-t border-border px-3 sm:px-4">
        <Link
          href={linkCalculadora}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Calculator aria-hidden="true" className="size-3.5" />
          Abrir na calculadora
        </Link>
      </div>
    </section>
  );
}

export function EsqueletoNumeros() {
  return (
    <div aria-busy="true" aria-label="Números (carregando)" className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface p-3 sm:p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
