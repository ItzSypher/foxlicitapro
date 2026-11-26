import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ItemCaixaLinha } from "@/components/caixa/item-caixa";
import { rotuloDoMes } from "@/components/caixa/formato";
import { montarFluxoCaixa, type FluxoCaixa } from "@/core/fluxo-caixa";
import { listarGanhosParaCaixa } from "@/db/fluxo-caixa";
import { lerComissaoPadrao } from "@/db/empresas";
import { formatarMoedaCurta } from "@/lib/formato";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Caixa · FoxLicita Pro" };

/** Dia civil de hoje em São Paulo, "AAAA-MM-DD". */
function diaDeHoje(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function Numero({ rotulo, valor, apoio, className }: { rotulo: string; valor: string; apoio?: string; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 bg-surface p-4 ${className ?? ""}`}>
      <p className="text-[13px] text-muted-foreground">{rotulo}</p>
      <p className="text-2xl leading-none font-semibold tabular-nums text-ink">{valor}</p>
      {apoio ? <p className="text-xs text-muted-foreground">{apoio}</p> : null}
    </div>
  );
}

export default async function CaixaPage() {
  await connection();
  const sessao = await exigirSessao();
  // Comissão e lucro são só do dono: o gestor não vê nem a página.
  if (sessao.papel !== "dono") redirect("/radar");

  const hoje = diaDeHoje();
  let fluxo: FluxoCaixa | null = null;
  let comissaoPadrao = 0;
  try {
    comissaoPadrao = await lerComissaoPadrao(sessao.empresaId);
    fluxo = montarFluxoCaixa(await listarGanhosParaCaixa(sessao.empresaId), comissaoPadrao, hoje);
  } catch (e) {
    console.error("[caixa] leitura falhou:", e instanceof Error ? e.message : e);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Caixa</h1>
        <p className="text-sm text-muted-foreground">O que entra das licitações ganhas, quando entra e o que sobra depois do custo e da comissão.</p>
      </header>

      {fluxo === null ? (
        <p role="alert" className="text-sm text-negative">
          Não foi possível carregar o caixa agora. Tente de novo em instantes.
        </p>
      ) : fluxo.meses.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-control px-5 py-10">
          <p className="text-sm text-muted-foreground">Nenhuma licitação ganha ainda. Ao mover uma para Ganha no Pipeline, ela entra aqui.</p>
          <Link
            href="/pipeline"
            className="inline-flex h-11 items-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Ir para o Pipeline
          </Link>
        </div>
      ) : (
        <>
          <section aria-label="Resumo" className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3">
            <Numero
              rotulo="A receber"
              valor={formatarMoedaCurta(fluxo.resumo.aReceber)}
              apoio={fluxo.resumo.atrasado > 0 ? `${formatarMoedaCurta(fluxo.resumo.atrasado)} atrasado` : undefined}
            />
            <Numero rotulo="Recebido no mês" valor={formatarMoedaCurta(fluxo.resumo.recebidoNoMes)} />
            <Numero
              rotulo="Saldo no fim"
              valor={formatarMoedaCurta(fluxo.resumo.saldo)}
              apoio="depois de custo e comissão"
              className="col-span-2 sm:col-span-1"
            />
          </section>

          {fluxo.meses.map((m) => (
            <section key={m.mes} aria-labelledby={`mes-${m.mes}`} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 id={`mes-${m.mes}`} className="text-base font-semibold text-ink first-letter:uppercase">
                  {rotuloDoMes(m.mes)}
                </h2>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Sobra {formatarMoedaCurta(m.saldo)} · comissão {formatarMoedaCurta(m.comissao)}
                </p>
              </div>
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                {m.itens.map((i) => (
                  <ItemCaixaLinha key={i.id} item={i} hoje={hoje} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
