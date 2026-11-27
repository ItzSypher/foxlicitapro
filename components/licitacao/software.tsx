"use client";

import { useId, useState, useTransition } from "react";
import { Minus } from "lucide-react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { Interruptor } from "@/components/ui/interruptor";
import { Segmentado, type OpcaoSegmentada } from "@/components/ui/segmentado";
import {
  salvarComissaoItemAction,
  salvarSoftwareAction,
} from "@/app/(app)/licitacao/[cnpj]/[ano]/[sequencial]/software-actions";
import {
  MAXIMO_HORAS_MES,
  MAXIMO_MESES_CONTRATO,
  MAXIMO_PARCELAS,
  lerInteiroDigitado,
  lerNumeroDigitado,
  linhaRepasse,
  motivoVisivel,
  type DadosSoftware,
} from "@/core/campos-software";
import {
  HORAS_POR_MES,
  MINIMO_MENSAL_SOFTWARE,
  VALOR_HORA,
  contaSoftware,
  cronogramaRepasse,
  mesesDoContrato,
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
  /** Dono e gestor veem a conta inteira (lucro, comissão e repasse); o jurídico só o veredito e o mínimo */
  veConta: boolean;
  /** Site, sistema ou software: vale o mínimo de R$ 3.500/mês; false nos demais serviços */
  desenvolvimento: boolean;
  /** Valor estimado do edital, para saber quanto dá para baixar */
  valorReferencia: number | null;
  /** Percentual que aparece ao marcar "Tem comissão" */
  comissaoPadrao: number;
  /** Meses que o edital sugere; null para entrega única */
  mesesDoEdital: number | null;
  inicial: DadosSoftware;
}

type Resposta = "sim" | "nao" | "";

const OPCOES: ReadonlyArray<OpcaoSegmentada<Resposta>> = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

const ROTULO_BASE = { lance: "Recebe no seu lance", minimo: "Recebe no preço mínimo", edital: "Recebe no valor do edital" } as const;
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

function aoEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.currentTarget.blur();
}

/** Uma pergunta numerada, com a ajuda logo abaixo. */
function Pergunta({ n, titulo, ajuda, children }: { n: number; titulo: string; ajuda?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-muted-foreground"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{children}</div>
        {ajuda ? <p className="text-[13px] text-muted-foreground">{ajuda}</p> : null}
      </div>
    </li>
  );
}

function Linha({ rotulo, menos, children }: { rotulo: string; menos?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="inline-flex shrink-0 items-center gap-1 text-right text-sm font-medium tabular-nums text-ink">
        {menos ? <Minus aria-hidden="true" className="size-3 text-muted-foreground" /> : null}
        {children}
      </dd>
    </div>
  );
}

/**
 * Conta de serviço em perguntas: terceiriza? quanto custa o dev ou quantas horas você gasta? quantos meses?
 * tem comissão? qual o lance? Só depois das duas primeiras respostas aparecem os números.
 * Sem lance, a conta usa o preço mínimo (o pior caso de quem vai baixar o preço).
 */
export function BlocoSoftware({ compra, salvo, veConta, desenvolvimento, valorReferencia, comissaoPadrao, mesesDoEdital, inicial }: Props) {
  const idBase = useId();
  const [terceirizavel, setTerceirizavel] = useState<boolean | null>(inicial.terceirizavel);
  const [meses, setMeses] = useState(textoNumero(inicial.contratoMeses));
  const [devCusto, setDevCusto] = useState(textoNumero(inicial.devCusto));
  const [devSemPreco, setDevSemPreco] = useState(false);
  const [parcelas, setParcelas] = useState(textoNumero(inicial.devParcelas));
  const [horas, setHoras] = useState(textoNumero(inicial.horasMes));
  const [lance, setLance] = useState(textoNumero(inicial.precoLance));
  const [comissao, setComissao] = useState<number | null>(inicial.comissaoPercentual);
  const [comissaoTexto, setComissaoTexto] = useState(inicial.comissaoPercentual === null ? "" : textoPercentual(inicial.comissaoPercentual));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const mesesNum = lerInteiroDigitado(meses, 1, MAXIMO_MESES_CONTRATO);
  const devNum = lerNumeroDigitado(devCusto);
  const parcelasNum = lerInteiroDigitado(parcelas, 1, MAXIMO_PARCELAS);
  const horasNum = lerInteiroDigitado(horas, 1, MAXIMO_HORAS_MES);
  const lanceNum = lerNumeroDigitado(lance);
  const percentual = comissao ?? 0;

  /** Confere o que foi digitado; texto preenchido e inválido não é gravado. */
  function digitadoValido(): boolean {
    const invalido: Array<[boolean, string]> = [
      [meses.trim() !== "" && mesesNum === null, `Meses de contrato: use um número de 1 a ${MAXIMO_MESES_CONTRATO}, ou deixe vazio para entrega única.`],
      [devCusto.trim() !== "" && devNum === null, "Valor do dev: digite em reais, por exemplo 2.500,00."],
      [parcelas.trim() !== "" && parcelasNum === null, `Vezes do dev: use um número de 1 a ${MAXIMO_PARCELAS}.`],
      [horas.trim() !== "" && horasNum === null, `Horas por mês: use um número inteiro de 1 a ${MAXIMO_HORAS_MES}.`],
      [lance.trim() !== "" && (lanceNum === null || lanceNum <= 0), "Lance: digite em reais, por exemplo 45.000,00."],
    ];
    const achado = invalido.find(([ruim]) => ruim);
    setErro(achado ? achado[1] : null);
    return !achado;
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
        precoLance: lanceNum,
        horasMes: horasNum,
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

  const segundaRespondida =
    terceirizavel === true ? devNum !== null || devSemPreco : terceirizavel === false ? horasNum !== null : false;

  // O preço mínimo não depende do bruto: uma conta prévia dá o mínimo, e sem lance a conta usa esse mínimo.
  const entrada = {
    meses: mesesNum,
    comissaoPercentual: percentual,
    terceirizavel,
    devCusto: devNum,
    horasMes: horasNum,
    valorReferencia,
    desenvolvimento,
  };
  const previa = contaSoftware({ ...entrada, bruto: 1 });
  const precoMinimo = previa?.precoMinimo ?? 0;
  const doLance = lanceNum !== null && lanceNum > 0;
  // Sem lance: o mínimo; sem mínimo (serviço com dev ainda sem preço), o valor do edital.
  const base: "lance" | "minimo" | "edital" = doLance ? "lance" : precoMinimo > 0 ? "minimo" : "edital";
  const brutoUsado = base === "lance" ? (lanceNum ?? 0) : base === "minimo" ? precoMinimo : (valorReferencia ?? 0);
  const conta = brutoUsado > 0 ? contaSoftware({ ...entrada, bruto: brutoUsado }) : null;
  const baseTeto = doLance ? (lanceNum ?? 0) : (valorReferencia ?? precoMinimo);
  const teto = baseTeto > 0 ? tetoDoDev(baseTeto, percentual) : null;
  const repasse =
    veConta && conta ? cronogramaRepasse(conta.bruto, mesesNum, percentual, terceirizavel === true ? devNum : null, parcelasNum) : [];
  const n = mesesDoContrato(mesesNum);
  const sugerido = mesesDoEdital === null ? "o edital não fala em meses (entrega única)" : `o edital sugere ${mesesDoEdital} meses`;

  return (
    <div className="flex flex-col gap-4 border-t border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">{desenvolvimento ? "Conta do site, sistema ou software" : "Conta do serviço"}</h3>
        {salvo ? null : <Pilula tom="aviso">Salve no pipeline para guardar</Pilula>}
      </div>

      <ol className="flex flex-col gap-4">
        <Pergunta n={1} titulo="Vai terceirizar (pagar alguém para fazer)?">
          <Segmentado<Resposta> rotulo="Vai terceirizar?" valor={respostaDe(terceirizavel)} opcoes={OPCOES} aoMudar={escolher} />
        </Pergunta>

        {terceirizavel === true ? (
          <Pergunta
            n={2}
            titulo="Quanto o dev cobra pelo projeto todo?"
            ajuda={
              teto === null
                ? "Com o valor, a conta mostra se sobra a metade para você."
                : `Para ficar com pelo menos metade${percentual > 0 ? " depois da comissão" : ""}, pague no máximo ${formatarMoeda(teto)}${doLance ? " neste lance" : " no valor do edital"}.`
            }
          >
            <label htmlFor={`${idBase}-dev`}>R$</label>
            <input
              id={`${idBase}-dev`}
              inputMode="decimal"
              value={devCusto}
              placeholder="0,00"
              onChange={(e) => {
                setDevCusto(e.target.value);
                setDevSemPreco(false);
              }}
              onBlur={() => gravar(terceirizavel)}
              onKeyDown={aoEnter}
              className={cn(CLASSE_CAMPO, "w-32 text-right tabular-nums")}
            />
            <label htmlFor={`${idBase}-parcelas`}>em</label>
            <input
              id={`${idBase}-parcelas`}
              inputMode="numeric"
              value={parcelas}
              placeholder="1"
              onChange={(e) => setParcelas(e.target.value)}
              onBlur={() => gravar(terceirizavel)}
              onKeyDown={aoEnter}
              className={cn(CLASSE_CAMPO, "w-16 text-center tabular-nums")}
            />
            <span>vezes</span>
            {devNum === null && !devSemPreco ? (
              <button
                type="button"
                onClick={() => setDevSemPreco(true)}
                className="min-h-11 rounded-control px-2 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                Ainda não sei
              </button>
            ) : null}
          </Pergunta>
        ) : null}

        {terceirizavel === false ? (
          <Pergunta
            n={2}
            titulo="Quantas horas por mês você vai gastar?"
            ajuda={`Cada hora entra como custo de ${formatarMoeda(VALOR_HORA)}.${desenvolvimento ? ` O mínimo do contrato é ${HORAS_POR_MES} h (${formatarMoeda(MINIMO_MENSAL_SOFTWARE)}/mês).` : ""}`}
          >
            <input
              id={`${idBase}-horas`}
              aria-label="Horas por mês"
              inputMode="numeric"
              value={horas}
              placeholder={String(HORAS_POR_MES)}
              onChange={(e) => setHoras(e.target.value)}
              onBlur={() => gravar(terceirizavel)}
              onKeyDown={aoEnter}
              className={cn(CLASSE_CAMPO, "w-20 text-center tabular-nums")}
            />
            <span>horas por mês</span>
          </Pergunta>
        ) : null}

        {segundaRespondida ? (
          <>
            <Pergunta n={3} titulo="Quantos meses de contrato?" ajuda={`Vazio = entrega única (conta 1 mês). Aqui ${sugerido}.`}>
              <input
                id={`${idBase}-meses`}
                aria-label="Meses de contrato"
                inputMode="numeric"
                value={meses}
                placeholder="Único"
                onChange={(e) => setMeses(e.target.value)}
                onBlur={() => gravar(terceirizavel)}
                onKeyDown={aoEnter}
                className={cn(CLASSE_CAMPO, "w-20 text-center tabular-nums")}
              />
              <span>meses</span>
            </Pergunta>

            {veConta ? (
              <Pergunta n={4} titulo="Tem comissão?">
                <Interruptor
                  rotulo={comissao === null ? "Sem comissão" : "Com comissão"}
                  checked={comissao !== null}
                  disabled={salvando}
                  onChange={(e) => alternarComissao(e.target.checked)}
                />
                {comissao !== null ? (
                  <>
                    <label htmlFor={`${idBase}-comissao`} className="sr-only">
                      Percentual da comissão
                    </label>
                    <input
                      id={`${idBase}-comissao`}
                      inputMode="decimal"
                      value={comissaoTexto}
                      onChange={(e) => setComissaoTexto(e.target.value)}
                      onBlur={sairDoPercentual}
                      onKeyDown={aoEnter}
                      className={cn(CLASSE_CAMPO, "w-20 text-center tabular-nums")}
                    />
                    <span aria-hidden="true">% do que o cliente pagar</span>
                  </>
                ) : null}
              </Pergunta>
            ) : null}

            <Pergunta
              n={veConta ? 5 : 4}
              titulo="Por quanto vai dar o lance?"
              ajuda={
                precoMinimo > 0
                  ? `Não baixe de ${formatarMoeda(precoMinimo)}.${valorReferencia === null ? "" : ` O edital estima ${formatarMoeda(valorReferencia)}.`} Sem lance, a conta usa o mínimo.`
                  : "Sem lance, a conta usa o preço mínimo."
              }
            >
              <label htmlFor={`${idBase}-lance`}>R$</label>
              <input
                id={`${idBase}-lance`}
                inputMode="decimal"
                value={lance}
                placeholder={precoMinimo > 0 ? textoNumero(precoMinimo) : "0,00"}
                onChange={(e) => setLance(e.target.value)}
                onBlur={() => gravar(terceirizavel)}
                onKeyDown={aoEnter}
                className={cn(CLASSE_CAMPO, "w-36 text-right tabular-nums")}
              />
            </Pergunta>
          </>
        ) : null}
      </ol>

      {segundaRespondida ? (
        <div className="flex flex-col gap-2 rounded-control border border-border bg-raised p-3">
          {conta ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Pilula tom={TOM_VEREDITO[conta.veredito]}>{ROTULO_VEREDITO[conta.veredito]}</Pilula>
                <p className="min-w-0 text-sm break-words text-muted-foreground">{motivoVisivel(conta, veConta)}</p>
              </div>
              {veConta ? (
                <dl className="flex flex-col divide-y divide-border">
                  <Linha rotulo={ROTULO_BASE[base]}>{formatarMoeda(conta.bruto)}</Linha>
                  {conta.devCusto > 0 ? (
                    <Linha rotulo="Dev" menos>
                      {formatarMoeda(conta.devCusto)}
                    </Linha>
                  ) : null}
                  {conta.custoProprio > 0 && horasNum !== null ? (
                    <Linha rotulo={`Suas horas: ${horasNum} h × ${formatarMoeda(VALOR_HORA)} × ${n} ${n === 1 ? "mês" : "meses"}`} menos>
                      {formatarMoeda(conta.custoProprio)}
                    </Linha>
                  ) : null}
                  {conta.comissao > 0 ? (
                    <Linha rotulo={`Comissão ${textoPercentual(percentual)}%`} menos>
                      {formatarMoeda(conta.comissao)}
                    </Linha>
                  ) : null}
                  <Linha rotulo={conta.custoProprio > 0 ? "Lucro além das suas horas" : "Lucro"}>
                    <span className={cn(conta.sobra < 0 ? "text-negative" : "text-positive")}>{formatarMoeda(conta.sobra)}</span>
                    <span className="ml-1 text-xs font-medium text-muted-foreground">{conta.margemPercentual.toLocaleString("pt-BR")}%</span>
                  </Linha>
                </dl>
              ) : (
                <dl className="flex flex-col divide-y divide-border">
                  <Linha rotulo="Preço mínimo">{formatarMoeda(precoMinimo)}</Linha>
                </dl>
              )}
              {conta.folga !== null && conta.folgaPercentual !== null ? (
                <p className="text-sm text-ink">
                  {conta.folga >= 0
                    ? `Dá para baixar até ${formatarMoeda(conta.folga)} (${conta.folgaPercentual.toLocaleString("pt-BR")}%) do valor do edital.`
                    : `O preço mínimo passa do valor do edital em ${formatarMoeda(-conta.folga)}.`}
                </p>
              ) : null}
              {repasse.length > 1 || (repasse.length === 1 && conta.devCusto > 0) ? (
                <details className="rounded-control border border-border bg-surface">
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Diga o lance ou o custo para ver a conta.</p>
          )}
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
