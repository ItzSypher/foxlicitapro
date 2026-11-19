"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { excluirPropostaAction, marcarEnviadaAction } from "@/app/(app)/propostas/actions";
import { BlocoRecolhivel } from "@/components/propostas/bloco-recolhivel";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, Secao } from "@/components/propostas/campos";
import { LinhaDoTempo, QuadroResultado, type ResumoResultado } from "@/components/propostas/linha-do-tempo";
import { CamposEnvio, ENVIO_VAZIO, envioParaAction, type DadosEnvio } from "@/components/propostas/registrar-envio";
import { Pilula } from "@/components/radar/pilula";
import { TextoRecolhivel } from "@/components/ui/texto-recolhivel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EventoProposta } from "@/core/proposta-eventos";
import { formatarMoeda } from "@/lib/formato";

export interface PropostaExternaTela {
  id: string;
  titulo: string;
  orgao: string;
  numero: string;
  objeto: string;
  portal: string | null;
  total: number;
  enviadaEm: string | null;
  criadoPorNome: string | null;
  resultado: Omit<ResumoResultado, "status">;
}

const dataFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="text-[13px] text-muted-foreground sm:w-32 sm:shrink-0">{rotulo}</dt>
      <dd className="min-w-0 text-sm break-words text-ink">{valor}</dd>
    </div>
  );
}

/** Proposta enviada fora do sistema: só os dados do envio, o resultado e a linha do tempo (não há documento). */
export function PropostaExterna({
  proposta,
  eventos,
  podeEditar,
}: {
  proposta: PropostaExternaTela;
  eventos: EventoProposta[];
  podeEditar: boolean;
}) {
  const [envio, setEnvio] = useState<DadosEnvio>(ENVIO_VAZIO);
  const [anexando, setAnexando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const roteador = useRouter();

  function anexar() {
    setMensagem(null);
    iniciar(async () => {
      const r = await marcarEnviadaAction(proposta.id, envioParaAction(envio));
      if (!r.ok) {
        setMensagem(r.mensagem);
        return;
      }
      setEnvio(ENVIO_VAZIO);
      setAnexando(false);
      roteador.refresh();
    });
  }

  function confirmarExclusao() {
    setMensagem(null);
    iniciar(async () => {
      const r = await excluirPropostaAction(proposta.id);
      if (r && !r.ok) {
        setMensagem(r.mensagem);
        setExcluir(false);
      }
    });
  }

  const semProva = envio.protocolo.trim() === "" && envio.comprovante === null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3">
        <Link
          href="/propostas"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Propostas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Pilula tom="positivo">Enviada</Pilula>
          <Pilula tom="neutro">Enviada fora do sistema</Pilula>
        </div>
        <TextoRecolhivel
          texto={proposta.titulo}
          como="h1"
          linhas={2}
          className="text-[22px] leading-tight font-semibold break-words text-ink"
        />
        <p className="text-2xl font-semibold tabular-nums text-ink lg:hidden">{formatarMoeda(proposta.total)}</p>
        {mensagem && (
          <p role="alert" className="text-[13px] text-negative">
            {mensagem}
          </p>
        )}
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <Secao id="secao-envio-externo" titulo="Envio">
            <dl className="flex flex-col gap-2.5">
              <Linha rotulo="Órgão" valor={proposta.orgao || "—"} />
              <BlocoRecolhivel titulo="Detalhes" classeConteudo="gap-2.5 lg:contents">
                <Linha rotulo="Número" valor={proposta.numero || "—"} />
                {proposta.objeto !== "" && <Linha rotulo="Objeto" valor={proposta.objeto} />}
                <Linha rotulo="Portal" valor={proposta.portal ?? "—"} />
                <Linha rotulo="Valor" valor={formatarMoeda(proposta.total)} />
                <Linha rotulo="Enviada em" valor={proposta.enviadaEm ? dataFmt.format(new Date(proposta.enviadaEm)) : "—"} />
                <Linha rotulo="Registrada por" valor={proposta.criadoPorNome ?? "—"} />
              </BlocoRecolhivel>
            </dl>
          </Secao>

          {podeEditar && (
            <Secao id="secao-anexar" titulo="Mais um comprovante">
              {anexando ? (
                <div className="flex flex-col gap-3">
                  <CamposEnvio valor={envio} aoMudar={setEnvio} desabilitado={pendente} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={anexar} disabled={pendente || semProva} className={BOTAO_PRIMARIO}>
                      {pendente ? "Registrando…" : "Registrar"}
                    </button>
                    <button type="button" onClick={() => setAnexando(false)} className={BOTAO_SECUNDARIO}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAnexando(true)} className={BOTAO_SECUNDARIO}>
                  Anexar outro comprovante
                </button>
              )}
            </Secao>
          )}
        </div>

        <aside aria-label="Resultado e linha do tempo" className="flex min-w-0 flex-col gap-4">
          <Secao id="secao-linha-do-tempo" titulo="Linha do tempo">
            <QuadroResultado dados={{ status: "enviada", ...proposta.resultado }} />
            <BlocoRecolhivel titulo={`Ver linha do tempo e comprovantes (${eventos.length})`} classeConteudo="gap-0">
              <LinhaDoTempo propostaId={proposta.id} eventos={eventos} />
            </BlocoRecolhivel>
          </Secao>
          {podeEditar && (
            <button type="button" onClick={() => setExcluir(true)} className={`${BOTAO_SECUNDARIO} text-negative`}>
              <Trash2 aria-hidden className="size-4" />
              Excluir registro
            </button>
          )}
        </aside>
      </div>

      <Sheet open={excluir} onOpenChange={setExcluir}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="pr-14">
            <SheetTitle>Excluir este registro?</SheetTitle>
            <SheetDescription>
              {proposta.titulo}. O registro, os comprovantes e a linha do tempo deixam de existir. Não dá para desfazer.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={confirmarExclusao}
              disabled={pendente}
              className="inline-flex h-11 items-center justify-center rounded-control bg-pill-neg-bg px-4 text-sm font-medium text-pill-neg-fg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              {pendente ? "Excluindo…" : "Excluir"}
            </button>
            <button type="button" onClick={() => setExcluir(false)} className={BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
