"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { salvarCotacaoAction } from "@/app/(app)/calculadora/actions";
import { resumirObjeto } from "@/core/objeto";
import type { Regime } from "@/core/precificacao";
import type { Frente } from "@/core/types";
import type { CnaePerfil } from "@/core/perfil";
import type { CotacaoSalva } from "@/db/cotacoes";
import { formatarMoeda } from "@/lib/formato";
import { CampoNumero, CampoSelect, CampoTexto, Segmentado } from "./campos";
import { CotacoesSalvas } from "./cotacoes-salvas";
import {
  calcularFormulario,
  cnaesDaFrente,
  formularioDaEntrada,
  margemDoCnae,
  margensComoTexto,
} from "./estado";
import type { CampoNumerico, Formulario } from "./estado";
import { Memoria } from "./memoria";
import { parseNumeroBR } from "./numero";
import { Resultados } from "./resultados";

interface Props {
  itemId: string | null;
  objeto: string | null;
  inicial: Formulario;
  cotacoes: CotacaoSalva[];
  /** CNAEs da empresa, por frente */
  cnaes: CnaePerfil[];
}

const OPCOES_FRENTE: readonly { valor: Frente; rotulo: string }[] = [
  { valor: "servicos", rotulo: "Serviços" },
  { valor: "produtos", rotulo: "Produtos" },
];

const OPCOES_REGIME: readonly { valor: Regime; rotulo: string }[] = [
  { valor: "mei", rotulo: "MEI" },
  { valor: "simples", rotulo: "Simples Nacional" },
];

type Aviso = { tom: "ok" | "erro"; texto: string } | null;

export function CalculadoraView({ itemId, objeto, inicial, cotacoes, cnaes }: Props) {
  const [f, setF] = useState<Formulario>(inicial);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, iniciarSalvar] = useTransition();
  const resultadosRef = useRef<HTMLDivElement>(null);

  const estado = useMemo(() => calcularFormulario(f), [f]);
  const erros: Partial<Record<CampoNumerico, string>> = estado.tipo === "erro" ? estado.erros : {};
  const margem = margemDoCnae(f.cnae);
  const opcoesCnae = cnaesDaFrente(cnaes, f.frente).map((c) => ({ valor: c.codigo, rotulo: `${c.codigo} · ${c.descricao}` }));

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    setF((atual) => ({ ...atual, [campo]: valor }));
    setAviso(null);
  }

  function mudarFrente(frente: Frente): void {
    setF((atual) => {
      const cnaeContinua = cnaesDaFrente(cnaes, frente).some((c) => c.codigo === atual.cnae);
      return { ...atual, frente, cnae: cnaeContinua ? atual.cnae : "" };
    });
    setAviso(null);
  }

  function mudarCnae(codigo: string): void {
    setF((atual) => ({ ...atual, cnae: codigo, ...(codigo ? margensComoTexto(codigo) : {}) }));
    setAviso(null);
  }

  function escolherCotacao(c: CotacaoSalva): void {
    setF(formularioDaEntrada(c.descricao, c.frente, c.cnae, c.entrada));
    setAtiva(c.id);
    setAviso(null);
  }

  function irParaResultados(): void {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultadosRef.current?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
  }

  function salvar(): void {
    if (estado.tipo !== "ok") {
      setAviso({ tom: "erro", texto: "Preencha custo e margens para salvar." });
      return;
    }
    if (f.descricao.trim() === "") {
      setAviso({ tom: "erro", texto: "Descreva o que você está cotando." });
      return;
    }
    const e = estado.entrada;
    iniciarSalvar(async () => {
      const resposta = await salvarCotacaoAction({
        itemId,
        descricao: f.descricao,
        frente: f.frente,
        cnae: f.cnae === "" ? null : f.cnae,
        custo: e.custo,
        frete: e.frete,
        extras: e.extras,
        tetoOrgao: e.tetoOrgao,
        margemMinima: e.margemMinima,
        margemAlvo: e.margemAlvo,
        regime: e.regime,
        vendasPrevistasNoMes: e.vendasPrevistasNoMes,
      });
      setAviso(resposta.ok ? { tom: "ok", texto: "Cotação salva." } : { tom: "erro", texto: resposta.mensagem });
    });
  }

  const vendas = parseNumeroBR(f.vendas);
  const resumoBarra =
    estado.tipo === "ok"
      ? `Mínimo ${formatarMoeda(estado.calculo.precoMinimo.preco)} · Alvo ${formatarMoeda(estado.calculo.precoAlvo.preco)}`
      : "Mínimo — · Alvo —";

  return (
    <>
      <div className="grid gap-6 pb-[calc(64px+56px+env(safe-area-inset-bottom))] lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-x-8 lg:pb-0">
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          {objeto !== null && (
            <div className="flex flex-col gap-1 rounded-card border border-border bg-raised px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Oportunidade do pipeline</span>
              <p className="line-clamp-2 text-sm text-ink">{resumirObjeto(objeto)}</p>
            </div>
          )}

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              salvar();
            }}
          >
            <CampoTexto
              id="cal-descricao"
              rotulo="Descrição"
              valor={f.descricao}
              onMudar={(v) => mudar("descricao", v)}
              placeholder="Ex.: 20 monitores de 24 polegadas"
            />
            <Segmentado nome="cal-frente" rotulo="Frente" valor={f.frente} opcoes={OPCOES_FRENTE} onMudar={mudarFrente} />
            <CampoSelect
              id="cal-cnae"
              rotulo="Atividade (CNAE)"
              valor={f.cnae}
              onMudar={mudarCnae}
              opcoes={opcoesCnae}
              vazio="Escolha a atividade"
              dica={margem ? margem.justificativa : "Ao escolher, sugerimos as margens."}
            />
            <CampoNumero
              id="cal-custo"
              rotulo="Custo do produto ou serviço"
              prefixo="R$"
              valor={f.custo}
              onMudar={(v) => mudar("custo", v)}
              erro={erros.custo}
              placeholder="0,00"
            />
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <CampoNumero
                id="cal-frete"
                rotulo="Frete ou deslocamento"
                prefixo="R$"
                valor={f.frete}
                onMudar={(v) => mudar("frete", v)}
                erro={erros.frete}
                placeholder="0,00"
              />
              <CampoNumero
                id="cal-extras"
                rotulo="Extras e garantia"
                prefixo="R$"
                valor={f.extras}
                onMudar={(v) => mudar("extras", v)}
                erro={erros.extras}
                placeholder="0,00"
              />
            </div>
            <CampoNumero
              id="cal-teto"
              rotulo="Teto do órgão (opcional)"
              prefixo="R$"
              valor={f.teto}
              onMudar={(v) => mudar("teto", v)}
              erro={erros.teto}
              placeholder="Valor estimado do edital"
            />
            <div className="grid grid-cols-2 gap-3">
              <CampoNumero
                id="cal-margem-minima"
                rotulo="Margem mínima"
                sufixo="%"
                valor={f.margemMinima}
                onMudar={(v) => mudar("margemMinima", v)}
                erro={erros.margemMinima}
              />
              <CampoNumero
                id="cal-margem-alvo"
                rotulo="Margem alvo"
                sufixo="%"
                valor={f.margemAlvo}
                onMudar={(v) => mudar("margemAlvo", v)}
                erro={erros.margemAlvo}
              />
            </div>
            <Segmentado
              nome="cal-regime"
              rotulo="Regime"
              valor={f.regime}
              opcoes={OPCOES_REGIME}
              onMudar={(v) => mudar("regime", v)}
            />
            {f.regime === "mei" && (
              <CampoNumero
                id="cal-vendas"
                rotulo="Vendas previstas no mês"
                valor={f.vendas}
                onMudar={(v) => mudar("vendas", v)}
                erro={erros.vendas}
                dica="O DAS do mês é dividido por essas vendas."
              />
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={salvando}
                className="h-11 w-full rounded-control bg-brand text-base font-semibold text-black outline-none hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar cotação"}
              </button>
              <p
                role={aviso?.tom === "erro" ? "alert" : "status"}
                className={aviso?.tom === "erro" ? "min-h-5 text-[13px] text-negative" : "min-h-5 text-[13px] text-positive"}
              >
                {aviso?.texto ?? ""}
              </p>
            </div>
          </form>
        </div>

        <div
          ref={resultadosRef}
          id="resultados"
          className="flex scroll-mt-16 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:p-1"
        >
          <Resultados estado={estado} />
          {estado.tipo === "ok" && (
            <Memoria
              calculo={estado.calculo}
              frente={f.frente}
              vendas={vendas !== null && Number.isFinite(vendas) ? vendas : 0}
            />
          )}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <CotacoesSalvas cotacoes={cotacoes} ativa={ativa} deOportunidade={itemId !== null} onEscolher={escolherCotacao} />
        </div>
      </div>

      <button
        type="button"
        onClick={irParaResultados}
        aria-label={`${resumoBarra}. Ver resultados`}
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex h-14 items-center justify-center border-t border-border bg-raised px-4 text-sm font-medium tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand lg:hidden"
      >
        {resumoBarra}
      </button>
    </>
  );
}
