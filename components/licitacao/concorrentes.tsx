"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { buscarConcorrentesAction } from "@/app/(app)/licitacao/[cnpj]/[ano]/[sequencial]/concorrentes-actions";
import { formatarDataHoraBrasilia } from "@/core/datas-edital";
import { descontoPct, type ResultadoConcorrentes } from "@/core/concorrentes";
import { formatarMoeda } from "@/lib/formato";
import { Colapsavel } from "./colapsavel";

interface Props {
  /** "{cnpj}-{ano}-{sequencial}" */
  compra: string;
  inicial: ResultadoConcorrentes | null;
  buscadoEmInicial: string | null;
  valorEstimado: number | null;
  /** Tem a permissão de editar propostas */
  podeBuscar: boolean;
}

const BOTAO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-semibold whitespace-nowrap text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:opacity-50";

const fmtMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "2-digit", year: "numeric" });

function pct(v: number): string {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-ground p-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="font-mono text-2xl leading-tight font-semibold tabular-nums text-ink wrap-break-word">{valor}</span>
    </div>
  );
}

/** Preços de contratações parecidas já homologadas no PNCP (amostra dos últimos 12 meses). */
export function Concorrentes({ compra, inicial, buscadoEmInicial, valorEstimado, podeBuscar }: Props) {
  const [resultado, setResultado] = useState<ResultadoConcorrentes | null>(inicial);
  const [buscadoEm, setBuscadoEm] = useState<string | null>(buscadoEmInicial);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function buscar(atualizar: boolean) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const r = await buscarConcorrentesAction(compra, atualizar);
      if (r.ok) {
        setResultado(r.resultado);
        setBuscadoEm(r.buscadoEm);
        setAviso(r.aviso);
      } else {
        setErro(r.erro);
      }
    } catch {
      setErro("Não foi possível buscar os preços agora.");
    }
    setOcupado(false);
  }

  const e = resultado?.estatisticas;
  const quando = formatarDataHoraBrasilia(buscadoEm);

  return (
    <Colapsavel id="concorrentes" titulo="Concorrentes" resumo={e && e.amostras > 0 ? `${e.amostras} parecidas` : undefined}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-snug text-muted-foreground">
          Contratações parecidas já homologadas no PNCP (últimos 12 meses, mesma UF primeiro). É uma amostra: o PNCP não busca por texto.
        </p>

        {ocupado ? (
          <p role="status" className="flex items-center gap-2 rounded-card border border-border bg-ground p-3 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
            Consultando o PNCP. Pode levar alguns minutos.
          </p>
        ) : null}

        {podeBuscar ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => buscar(buscadoEm !== null)} disabled={ocupado} className={BOTAO}>
              <Search aria-hidden="true" className="size-4" />
              {buscadoEm === null ? "Buscar preços no PNCP" : "Buscar de novo"}
            </button>
            {quando ? <span className="text-[13px] text-muted-foreground">Última busca: {quando}</span> : null}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">Quem edita propostas faz a busca. Aqui aparece o que já foi encontrado.</p>
        )}

        {erro ? (
          <p role="alert" className="text-sm text-negative">
            {erro}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-[13px] text-warning">
            {aviso}
          </p>
        ) : null}

        {resultado !== null && e && e.amostras === 0 ? (
          <p className="rounded-card border border-dashed border-control px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma contratação parecida e homologada encontrada
            {resultado.palavras.length > 0 ? ` para: ${resultado.palavras.join(", ")}` : ""}.
          </p>
        ) : null}

        {resultado !== null && e && e.amostras > 0 && e.media !== null && e.minimo !== null && e.maximo !== null ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Numero rotulo="Valor homologado médio" valor={formatarMoeda(e.media)} />
              <Numero rotulo="Desconto médio sobre o estimado" valor={e.descontoMedioPct === null ? "—" : pct(e.descontoMedioPct)} />
              <Numero rotulo="Mínimo" valor={formatarMoeda(e.minimo)} />
              <Numero rotulo="Máximo" valor={formatarMoeda(e.maximo)} />
            </div>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {e.amostras} {e.amostras === 1 ? "amostra" : "amostras"}
              {e.amostrasComDesconto !== e.amostras ? ` (${e.amostrasComDesconto} com estimado para calcular o desconto)` : ""}
              {resultado.naMesmaUf > 0 ? ` · ${resultado.naMesmaUf} na mesma UF` : ""}.
              {resultado.valorProvavel !== null && valorEstimado !== null
                ? ` Com esse desconto, o estimado de ${formatarMoeda(valorEstimado)} tenderia a ${formatarMoeda(resultado.valorProvavel)}.`
                : ""}
            </p>

            <ul className="flex flex-col gap-2" aria-label="Contratações mais parecidas">
              {resultado.maisParecidas.map((p) => {
                const d = descontoPct(p.valorEstimado, p.valorHomologado);
                return (
                  <li key={p.idPncp} className="flex flex-col gap-1 rounded-card border border-border bg-ground p-3">
                    <p className="line-clamp-2 text-sm leading-snug text-ink">{p.objeto}</p>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                      {p.orgao || "Órgão não informado"}
                      {p.uf ? ` · ${p.uf}` : ""}
                      {p.publicadaEm ? ` · ${fmtMes.format(new Date(p.publicadaEm))}` : ""}
                    </p>
                    <p className="font-mono text-sm tabular-nums text-ink">
                      {formatarMoeda(p.valorHomologado)}
                      {p.valorEstimado !== null ? (
                        <span className="text-muted-foreground"> de {formatarMoeda(p.valorEstimado)}</span>
                      ) : null}
                      {d !== null ? <span className="text-muted-foreground"> · {pct(d)} abaixo</span> : null}
                    </p>
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1.5 self-start rounded-control text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Ver no PNCP
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </Colapsavel>
  );
}
