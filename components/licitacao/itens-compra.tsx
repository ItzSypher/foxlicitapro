"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Pilula } from "@/components/radar/pilula";
import { Paginacao } from "@/components/radar/paginacao";
import type { ItemCompra } from "@/core/types-detalhe";
import { formatarMoeda, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { contaDoItem, quantidadeBr, somaItens, unitarioBr } from "./dominio";
import { Secao } from "./secao";

const POR_PAGINA = 20;
const LIMITE_DESCRICAO = 150;

function dobrar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const SEM_VALOR = <span className="text-faint">—</span>;

/** Descrição de até 3 linhas; a área inteira vira o botão "ver mais" quando o texto é longo. */
function Descricao({ texto, className }: { texto: string; className?: string }) {
  const [aberta, setAberta] = useState(false);
  const longa = texto.length > LIMITE_DESCRICAO;
  if (!longa) return <p className={cn("text-sm leading-snug wrap-break-word text-ink", className)}>{texto}</p>;
  return (
    <button
      type="button"
      onClick={() => setAberta((v) => !v)}
      aria-expanded={aberta}
      className={cn(
        "min-h-11 w-full rounded-control text-left text-sm leading-snug wrap-break-word text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className,
      )}
    >
      <span className={aberta ? "" : "line-clamp-3"}>{texto}</span>
      <span className="mt-0.5 block text-[13px] font-medium text-brand">{aberta ? "ver menos" : "ver mais"}</span>
    </button>
  );
}

function Beneficio({ item }: { item: ItemCompra }) {
  if (item.exclusivoMeEpp) return <Pilula tom="positivo">ME/EPP</Pilula>;
  if (item.beneficio) return <span className="text-[13px] text-muted-foreground">{item.beneficio}</span>;
  return SEM_VALOR;
}

function LinhaTelefone({ item }: { item: ItemCompra }) {
  return (
    <li className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="w-8 shrink-0 pt-[11px] text-right font-mono text-xs tabular-nums text-muted-foreground">
          {item.numero}
        </span>
        <Descricao texto={item.descricao || "Sem descrição"} className="min-w-0 flex-1 py-2" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-1 pl-11">
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground">{contaDoItem(item)}</span>
        {item.exclusivoMeEpp ? <Pilula tom="positivo">ME/EPP</Pilula> : null}
      </div>
    </li>
  );
}

const CABECA = "px-3 py-2 text-xs font-medium text-muted-foreground";

function TabelaDesktop({ itens }: { itens: readonly ItemCompra[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Itens da contratação</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={cn(CABECA, "w-12 text-left")}>
              Nº
            </th>
            <th scope="col" className={cn(CABECA, "min-w-[220px] text-left")}>
              Descrição
            </th>
            <th scope="col" className={cn(CABECA, "text-right")}>
              Qtd
            </th>
            <th scope="col" className={cn(CABECA, "text-left")}>
              Unidade
            </th>
            <th scope="col" className={cn(CABECA, "text-right")}>
              Unitário
            </th>
            <th scope="col" className={cn(CABECA, "text-right")}>
              Total
            </th>
            <th scope="col" className={cn(CABECA, "text-left")}>
              Benefício
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.numero} className="border-b border-border align-top last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">{item.numero}</td>
              <td className="px-3 py-1">
                <Descricao texto={item.descricao || "Sem descrição"} className="py-1" />
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">
                {item.quantidade === null ? SEM_VALOR : quantidadeBr(item.quantidade)}
              </td>
              <td className="px-3 py-3 text-[13px] text-muted-foreground">{item.unidade ?? SEM_VALOR}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-ink">
                {item.sigiloso ? (
                  <span className="font-sans text-[13px] text-muted-foreground">Sigiloso</span>
                ) : item.valorUnitarioEstimado === null ? (
                  SEM_VALOR
                ) : (
                  unitarioBr(item.valorUnitarioEstimado)
                )}
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-ink">
                {item.valorTotalEstimado === null ? SEM_VALOR : formatarMoeda(item.valorTotalEstimado)}
              </td>
              <td className="px-3 py-3">
                <Beneficio item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  itens: readonly ItemCompra[];
  totalItens: number;
  linkPncp: string;
  /** Itens que não carregaram: o aviso com "Tentar de novo" vem de fora */
  aviso: React.ReactNode;
}

export function ItensCompra({ itens, totalItens, linkPncp, aviso }: Props) {
  const [busca, setBusca] = useState("");
  const [soExclusivos, setSoExclusivos] = useState(false);
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = dobrar(busca.trim());
    return itens.filter((i) => {
      if (soExclusivos && !i.exclusivoMeEpp) return false;
      return termo === "" || dobrar(i.descricao).includes(termo) || String(i.numero) === termo;
    });
  }, [itens, busca, soExclusivos]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const inicio = (atual - 1) * POR_PAGINA;
  const visiveis = filtrados.slice(inicio, inicio + POR_PAGINA);
  const soma = useMemo(() => somaItens(itens), [itens]);
  const exclusivos = useMemo(() => itens.filter((i) => i.exclusivoMeEpp).length, [itens]);
  const incompleto = totalItens > itens.length;
  const filtrando = busca.trim() !== "" || soExclusivos;

  const resumo =
    totalItens > 0 ? (
      <>
        <span className="font-mono tabular-nums">{totalItens}</span> {plural(totalItens, "item", "itens")}
        {soma !== null ? (
          <>
            {" · soma "}
            <span className="font-mono tabular-nums">{formatarMoeda(soma)}</span>
          </>
        ) : null}
      </>
    ) : null;

  return (
    <Secao id="itens" titulo="Itens" detalhe={resumo}>
      {aviso}

      {itens.length > 0 ? (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="relative block md:max-w-sm md:flex-1">
              <span className="sr-only">Buscar nos itens</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar nos itens"
                className="h-11 w-full rounded-control border border-control bg-ground pr-3 pl-9 text-base text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand md:h-9 md:text-sm"
              />
            </label>
            <button
              type="button"
              aria-pressed={soExclusivos}
              onClick={() => {
                setSoExclusivos((v) => !v);
                setPagina(1);
              }}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-control border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-9",
                soExclusivos
                  ? "border-brand bg-active text-brand"
                  : "border-control bg-transparent text-ink hover:bg-active",
              )}
            >
              Só exclusivos ME/EPP
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{exclusivos}</span>
            </button>
          </div>

          {filtrados.length === 0 ? (
            <p className="rounded-card border border-dashed border-control px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum item encontrado{filtrando ? " com esse filtro" : ""}.
            </p>
          ) : (
            <>
              <TabelaDesktop itens={visiveis} />
              <ul className="rounded-card border border-border bg-surface px-3 md:hidden">
                {visiveis.map((item) => (
                  <LinhaTelefone key={item.numero} item={item} />
                ))}
              </ul>
              <Paginacao
                pagina={atual}
                totalPaginas={totalPaginas}
                inicio={inicio + 1}
                fim={inicio + visiveis.length}
                total={filtrados.length}
                onIr={setPagina}
              />
            </>
          )}
        </>
      ) : null}

      {incompleto && itens.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Mostrando <span className="font-mono tabular-nums">{itens.length}</span> de{" "}
          <span className="font-mono tabular-nums">{totalItens}</span> itens.{" "}
          <a
            href={linkPncp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
          >
            Ver todos no PNCP
          </a>
        </p>
      ) : null}

      {itens.length === 0 && totalItens === 0 && !aviso ? (
        <p className="rounded-card border border-dashed border-control px-4 py-8 text-center text-sm text-muted-foreground">
          O órgão não publicou itens.
        </p>
      ) : null}
    </Secao>
  );
}
