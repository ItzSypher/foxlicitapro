"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { OportunidadeComScore } from "@/core/types";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { resumirObjeto } from "@/core/objeto";
import { EXPLICACAO_CRITERIO } from "@/lib/glossario";
import { formatarCnpj, formatarEncerramento, formatarMoeda } from "@/lib/formato";
import { nomeFaixa, nomeModalidade } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { DicaGlossario, DicaModalidade, DicaNota, DicaValor } from "./dicas";
import { Pilula } from "./pilula";
import { ContagemTexto } from "./prazo";

const CONSULTA_DESKTOP = "(min-width: 768px)";

function assinarConsulta(avisar: () => void): () => void {
  const lista = window.matchMedia(CONSULTA_DESKTOP);
  lista.addEventListener("change", avisar);
  return () => lista.removeEventListener("change", avisar);
}

function useDesktop(): boolean {
  return useSyncExternalStore(
    assinarConsulta,
    () => window.matchMedia(CONSULTA_DESKTOP).matches,
    () => false,
  );
}

interface Props {
  item: OportunidadeComScore | null;
  aberto: boolean;
  onFechar: () => void;
  agoraInicial: number;
  /** Ações extras do detalhe, antes de "Abrir no PNCP" (ex.: "Salvar no pipeline"). */
  acoesExtras?: React.ReactNode;
}

/** Seção do detalhe; `dica` traz o balão "i" ao lado do título. */
function Secao({ titulo, dica, children }: { titulo: string; dica?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 text-base font-semibold text-ink">
        {titulo}
        {dica}
      </h3>
      {children}
    </section>
  );
}

export function DetalheSheet({ item, aberto, onFechar, agoraInicial, acoesExtras }: Props) {
  const desktop = useDesktop();

  return (
    <Sheet open={aberto} onOpenChange={(proximo) => (proximo ? undefined : onFechar())}>
      <SheetContent side={desktop ? "right" : "bottom"} className="gap-0">
        {item ? (
          <>
            <SheetHeader className="gap-1 border-b border-border p-4 pr-14">
              <SheetTitle className="text-[17px] leading-snug wrap-break-word">
                {resumirObjeto(item.objeto)}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {nomeModalidade(item.modalidadeId)} · {item.municipio} · {item.orgao}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
              <Secao titulo="Texto do edital">
                <p className="text-sm leading-relaxed wrap-break-word text-ink">{item.objeto}</p>
              </Secao>

              <Secao titulo="Órgão">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Órgão</dt>
                  <dd className="text-ink">{item.orgao}</dd>
                  <dt className="text-muted-foreground">Unidade</dt>
                  <dd className="text-ink">{item.unidade}</dd>
                  <dt className="text-muted-foreground">CNPJ</dt>
                  <dd className="font-mono tabular-nums text-ink">{formatarCnpj(item.orgaoCnpj)}</dd>
                </dl>
              </Secao>

              <div className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2">
                <Secao titulo="Modalidade" dica={<DicaModalidade modalidadeId={item.modalidadeId} className="-my-3.5" />}>
                  <p className="text-sm text-ink">{nomeModalidade(item.modalidadeId)}</p>
                </Secao>
                <Secao titulo="Como você participa" dica={<DicaGlossario chave="meEpp" rotulo="O que é ME/EPP?" className="-my-3.5" />}>
                  <p className="text-sm text-ink">MEI, tratado como ME/EPP</p>
                </Secao>
                <Secao titulo="Valor estimado" dica={<DicaValor className="-my-3.5" />}>
                  {item.valorEstimado === null ? (
                    <p className="text-2xl font-medium text-muted-foreground">Sigiloso</p>
                  ) : (
                    <p className="font-mono text-2xl font-medium tabular-nums text-ink">
                      {formatarMoeda(item.valorEstimado)}
                    </p>
                  )}
                </Secao>
                <Secao titulo="Encerramento" dica={<DicaGlossario chave="prazo" rotulo="O que é o prazo?" className="-my-3.5" />}>
                  <p className="text-sm text-ink">{formatarEncerramento(item.dataEncerramento)}</p>
                  <p className="text-sm text-muted-foreground">
                    Faltam <ContagemTexto encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
                  </p>
                </Secao>
              </div>

              <Secao titulo="Por que essa nota" dica={<DicaNota score={item.score} className="-my-3.5" />}>
                {item.score.alertas && item.score.alertas.length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1">
                    {item.score.alertas.map((alerta) => (
                      <li key={alerta} className="text-sm text-warning">
                        {alerta}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Pontuação por critério</caption>
                  <tbody>
                    {item.score.criterios.map((criterio) => (
                      <tr key={criterio.id} className="border-t border-border align-top first:border-t-0">
                        <th scope="row" className="py-3 pr-3 text-left font-normal">
                          <span className="block font-medium text-ink">{criterio.rotulo}</span>
                          <span className="block text-[13px] text-muted-foreground">{criterio.motivo}</span>
                          {criterio.id === "documentacao" ? (
                            <>
                              <span className="mt-1 block text-[13px] text-muted-foreground">
                                {EXPLICACAO_CRITERIO.documentacao}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted-foreground">
                                <span className="inline-flex items-center">
                                  CND
                                  <DicaGlossario chave="cnd" rotulo="O que é CND?" className="-my-3 -ml-1" />
                                </span>
                                <span className="inline-flex items-center">
                                  SICAF
                                  <DicaGlossario chave="sicaf" rotulo="O que é SICAF?" className="-my-3 -ml-1" />
                                </span>
                                <span className="inline-flex items-center">
                                  Atestado técnico
                                  <DicaGlossario chave="atestado" rotulo="O que é atestado de capacidade técnica?" className="-my-3 -ml-1" />
                                </span>
                              </span>
                            </>
                          ) : null}
                          {criterio.aConfirmar ? (
                            <Pilula tom="aviso" className="mt-1.5">
                              confirmar no edital
                            </Pilula>
                          ) : null}
                        </th>
                        <td className="whitespace-nowrap py-3 text-right font-mono tabular-nums text-ink">
                          {criterio.pontos}/{criterio.maximo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-control">
                      <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">
                        Total · {nomeFaixa(item.score.faixa)}
                      </th>
                      <td className="whitespace-nowrap py-3 text-right font-mono font-medium tabular-nums text-ink">
                        {item.score.total}/100
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Secao>

              <Secao titulo="CNAEs que casaram">
                {item.score.cnaesCasados.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {item.score.cnaesCasados.map((cnae) => (
                      <li key={cnae}>
                        <Pilula tom="neutro" className="font-mono tabular-nums">
                          {cnae}
                        </Pilula>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum CNAE casou com o objeto.</p>
                )}
              </Secao>
            </div>

            <SheetFooter className="mt-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] min-[480px]:flex-row min-[480px]:flex-wrap">
              <Link
                href={`/licitacao/${item.orgaoCnpj}/${item.anoCompra}/${item.sequencialCompra}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-semibold whitespace-nowrap text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand"
              >
                Ver licitação completa
              </Link>
              {acoesExtras}
              <a
                href={item.linkPncp}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 px-4 text-sm")}
              >
                Abrir no PNCP
              </a>
              {item.linkOrigem ? (
                <a
                  href={item.linkOrigem}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 px-4 text-sm")}
                >
                  Sistema de origem
                </a>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
