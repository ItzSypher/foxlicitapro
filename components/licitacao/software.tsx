"use client";

import { useId, useState, useTransition } from "react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { Interruptor } from "@/components/ui/interruptor";
import { Segmentado, type OpcaoSegmentada } from "@/components/ui/segmentado";
import {
  salvarComissaoItemAction,
  salvarSoftwareAction,
} from "@/app/(app)/licitacao/[cnpj]/[ano]/[sequencial]/software-actions";
import {
  MAXIMO_MESES_CONTRATO,
  MAXIMO_PARCELAS,
  lerInteiroDigitado,
  lerNumeroDigitado,
  linhaRepasse,
  motivoVisivel,
  type DadosSoftware,
} from "@/core/campos-software";
import {
  VALOR_HORA,
  contaSoftware,
  cronogramaRepasse,
  minimoDoContrato,
  tetoDoDev,
  type VereditoSoftware,
} from "@/core/custo-software";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Props {
  /** "{cnpj}-{ano}-{sequencial}" */
  compra: string;
  /** A licitação está no pipeline da empresa; sem isso nada é gravado */
  salvo: boolean;
  /** Dono vê sobra, margem, comissão e repasse; o gestor não */
  ehDono: boolean;
  /** Valor que a conta usa como bruto (preço alvo ou estimado); null sem valor */
  bruto: number | null;
  /** Valor estimado do edital, para saber quanto dá para baixar */
  valorReferencia: number | null;
  /** Percentual que aparece ao marcar "Tem comissão" */
  comissaoPadrao: number;
  inicial: DadosSoftware;
}

type Resposta = "sim" | "nao" | "";

const OPCOES: ReadonlyArray<OpcaoSegmentada<Resposta>> = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

const TOM_VEREDITO: Record<VereditoSoftware, TomPilula> = { vale: "positivo", "nao-vale": "negativo", pendente: "aviso" };
const ROTULO_VEREDITO: Record<VereditoSoftware, string> = { vale: "Vale", "nao-vale": "Não vale", pendente: "Falta resposta" };

function respostaDe(v: boolean | null): Resposta {
  return v === null ? "" : v ? "sim" : "nao";
}

function textoNumero(v: number | null): string {
  return v === null ? "" : String(v).replace(".", ",");
}

function textoPercentual(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="shrink-0 text-right text-sm font-medium tabular-nums text-ink">{children}</dd>
    </div>
  );
}

/** Site, sistema ou software: terceirização, veredito e, só para o dono, sobra, margem, comissão e repasse mês a mês. */
export function BlocoSoftware({ compra, salvo, ehDono, bruto, valorReferencia, comissaoPadrao, inicial }: Props) {
  const idBase = useId();
  const [terceirizavel, setTerceirizavel] = useState<boolean | null>(inicial.terceirizavel);
  const [meses, setMeses] = useState(textoNumero(inicial.contratoMeses));
  const [devCusto, setDevCusto] = useState(textoNumero(inicial.devCusto));
  const [parcelas, setParcelas] = useState(textoNumero(inicial.devParcelas));
  const [comissao, setComissao] = useState<number | null>(inicial.comissaoPercentual);
  const [comissaoTexto, setComissaoTexto] = useState(inicial.comissaoPercentual === null ? "" : textoPercentual(inicial.comissaoPercentual));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const mesesNum = lerInteiroDigitado(meses, 1, MAXIMO_MESES_CONTRATO);
  const devNum = lerNumeroDigitado(devCusto);
  const parcelasNum = lerInteiroDigitado(parcelas, 1, MAXIMO_PARCELAS);
  const percentual = comissao ?? 0;

  /** Confere o que foi digitado; texto preenchido e inválido não é gravado. */
  function digitadoValido(): boolean {
    if (meses.trim() !== "" && mesesNum === null) {
      setErro(`Meses de contrato: use um número de 1 a ${MAXIMO_MESES_CONTRATO}, ou deixe vazio para entrega única.`);
      return false;
    }
    if (devCusto.trim() !== "" && devNum === null) {
      setErro("Valor do dev: digite em reais, por exemplo 2.500,00.");
      return false;
    }
    if (parcelas.trim() !== "" && parcelasNum === null) {
      setErro(`Parcelas do dev: use um número de 1 a ${MAXIMO_PARCELAS}.`);
      return false;
    }
    setErro(null);
    return true;
  }

  function gravar(resposta: boolean | null) {
    if (!salvo || !digitadoValido()) return;
    iniciar(async () => {
      const r = await salvarSoftwareAction({
        compra,
        terceirizavel: resposta,
        devCusto: devNum,
        devParcelas: parcelasNum,
        contratoMeses: mesesNum,
      });
      if (!r.ok) setErro(r.erro);
    });
  }

  function gravarComissao(novo: number | null) {
    if (!salvo) return;
    iniciar(async () => {
      const r = await salvarComissaoItemAction({ compra, percentual: novo });
      if (!r.ok) setErro(r.erro);
    });
  }

  function escolher(r: Resposta) {
    const valor = r === "sim";
    setTerceirizavel(valor);
    gravar(valor);
  }

  function alternarComissao(ligar: boolean) {
    setErro(null);
    const novo = ligar ? comissaoPadrao : null;
    setComissao(novo);
    setComissaoTexto(novo === null ? "" : textoPercentual(novo));
    gravarComissao(novo);
  }

  function sairDoPercentual() {
    const p = lerNumeroDigitado(comissaoTexto);
    if (p === null || p < COMISSAO_MINIMA || p > COMISSAO_MAXIMA) {
      setErro(`Use uma comissão de ${COMISSAO_MINIMA} a ${COMISSAO_MAXIMA}%.`);
      return;
    }
    setErro(null);
    if (p === comissao) return;
    setComissao(p);
    gravarComissao(p);
  }

  const conta =
    bruto === null
      ? null
      : contaSoftware({ bruto, meses: mesesNum, comissaoPercentual: percentual, terceirizavel, devCusto: devNum, valorReferencia });
  const repasse =
    ehDono && bruto !== null ? cronogramaRepasse(bruto, mesesNum, percentual, terceirizavel === true ? devNum : null, parcelasNum) : [];
  const precoMinimo = conta ? conta.precoMinimo : minimoDoContrato(mesesNum);
  const teto = bruto === null ? null : tetoDoDev(bruto, percentual);

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">Site, sistema ou software</h3>
        {salvo ? null : <Pilula tom="aviso">Salve no pipeline para guardar</Pilula>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-ink">É terceirizável?</span>
        <Segmentado<Resposta> rotulo="É terceirizável?" valor={respostaDe(terceirizavel)} opcoes={OPCOES} aoMudar={escolher} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <label htmlFor={`${idBase}-meses`}>Meses de contrato</label>
          <input
            id={`${idBase}-meses`}
            inputMode="numeric"
            value={meses}
            placeholder="Único"
            onChange={(e) => setMeses(e.target.value)}
            onBlur={() => gravar(terceirizavel)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={cn(CLASSE_CAMPO, "w-24 text-center tabular-nums")}
          />
        </div>
        {terceirizavel === true ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${idBase}-dev`}>Dev: R$</label>
            <input
              id={`${idBase}-dev`}
              inputMode="decimal"
              value={devCusto}
              onChange={(e) => setDevCusto(e.target.value)}
              onBlur={() => gravar(terceirizavel)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className={cn(CLASSE_CAMPO, "w-28 text-right tabular-nums")}
            />
            <label htmlFor={`${idBase}-parcelas`}>em</label>
            <input
              id={`${idBase}-parcelas`}
              inputMode="numeric"
              value={parcelas}
              placeholder="1"
              onChange={(e) => setParcelas(e.target.value)}
              onBlur={() => gravar(terceirizavel)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className={cn(CLASSE_CAMPO, "w-16 text-center tabular-nums")}
            />
            <span>parcelas</span>
          </div>
        ) : null}
      </div>

      {conta ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Pilula tom={TOM_VEREDITO[conta.veredito]}>{ROTULO_VEREDITO[conta.veredito]}</Pilula>
          <p className="min-w-0 text-sm break-words text-muted-foreground">{motivoVisivel(conta, ehDono)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem valor no edital para calcular o veredito.</p>
      )}

      <dl className="flex flex-col divide-y divide-border">
        <Linha rotulo="Preço mínimo">{formatarMoeda(precoMinimo)}</Linha>
        {teto === null ? null : <Linha rotulo="Teto do dev">{formatarMoeda(teto)}</Linha>}
        {conta ? (
          <Linha rotulo="Hora paga x hora mínima">
            <span className={cn(conta.horaPaga + 0.005 < VALOR_HORA && "text-negative")}>{formatarMoeda(conta.horaPaga)}</span> x{" "}
            {formatarMoeda(VALOR_HORA)}
          </Linha>
        ) : null}
      </dl>
      {conta && conta.folga !== null && conta.folgaPercentual !== null ? (
        <p className="text-sm text-ink">
          {conta.folga >= 0
            ? `Dá para baixar até ${formatarMoeda(conta.folga)} (${conta.folgaPercentual.toLocaleString("pt-BR")}%) do valor do edital.`
            : `O preço mínimo passa do valor do edital em ${formatarMoeda(-conta.folga)}.`}
        </p>
      ) : null}

      {ehDono ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {conta ? (
            <dl className="flex flex-col divide-y divide-border">
              <Linha rotulo="Sobra para você">
                <span className={cn(conta.sobra < 0 && "text-negative")}>{formatarMoeda(conta.sobra)}</span>
                <span className="ml-2 text-xs font-medium text-muted-foreground">{conta.margemPercentual.toLocaleString("pt-BR")}%</span>
              </Linha>
            </dl>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Interruptor
              rotulo="Tem comissão"
              checked={comissao !== null}
              disabled={salvando}
              onChange={(e) => alternarComissao(e.target.checked)}
            />
            {comissao !== null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <label htmlFor={`${idBase}-comissao`} className="sr-only">
                  Percentual da comissão
                </label>
                <input
                  id={`${idBase}-comissao`}
                  inputMode="decimal"
                  value={comissaoTexto}
                  onChange={(e) => setComissaoTexto(e.target.value)}
                  onBlur={sairDoPercentual}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className={cn(CLASSE_CAMPO, "w-20 text-center tabular-nums")}
                />
                <span aria-hidden="true">%</span>
              </div>
            ) : null}
          </div>
          {repasse.length > 0 ? (
            <details className="rounded-control border border-border bg-raised">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">
                Repasse mês a mês
              </summary>
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto px-3 pb-3 text-[13px] tabular-nums text-muted-foreground">
                {repasse.map((m) => (
                  <li key={m.mes} className="break-words">
                    {linhaRepasse(m)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
