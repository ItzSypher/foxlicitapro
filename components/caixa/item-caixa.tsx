"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { CalendarDays, Check, Clock, TriangleAlert, Undo2 } from "lucide-react";
import {
  desfazerRecebidoAction,
  marcarRecebidoAction,
  salvarComissaoDoItemAction,
  salvarCustoRealAction,
  salvarPagamentoPrevistoAction,
  type ResultadoCaixa,
} from "@/app/(app)/caixa/actions";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "@/components/propostas/campos";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { lerValorDigitado, ROTULO_STATUS_CAIXA, type ItemCaixa, type StatusCaixa } from "@/core/fluxo-caixa";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";
import { formatarMoedaCurta } from "@/lib/formato";
import { diaCurto, textoPercentual } from "./formato";

const TOM_STATUS: Record<StatusCaixa, TomPilula> = { recebido: "positivo", atrasado: "negativo", "a-receber": "neutro" };

function IconeStatus({ status }: { status: StatusCaixa }) {
  if (status === "recebido") return <Check aria-hidden="true" className="size-3" />;
  if (status === "atrasado") return <TriangleAlert aria-hidden="true" className="size-3" />;
  return <Clock aria-hidden="true" className="size-3" />;
}

function fraseData(i: ItemCaixa): string {
  if (i.status === "recebido") return `Recebido em ${diaCurto(i.dataPrevista)}`;
  const previsto = `Previsto ${i.dataEstimada ? "~" : ""}${diaCurto(i.dataPrevista)}`;
  if (i.status === "atrasado") return `${previsto} · ${i.diasAtraso} ${i.diasAtraso === 1 ? "dia" : "dias"} de atraso`;
  return previsto;
}

type Painel = "recebi" | "data" | null;

export function ItemCaixaLinha({ item, hoje, comissaoAoMarcar }: { item: ItemCaixa; hoje: string; comissaoAoMarcar: number }) {
  const idBase = useId();
  const [painel, setPainel] = useState<Painel>(null);
  const [diaRecebido, setDiaRecebido] = useState(hoje);
  const [valorRecebido, setValorRecebido] = useState(String(item.valor).replace(".", ","));
  const [diaPrevisto, setDiaPrevisto] = useState(item.dataPrevista);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function executar(acao: () => Promise<ResultadoCaixa>, aoOk?: () => void) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r.ok) aoOk?.();
      else setErro(r.erro);
    });
  }

  function confirmarRecebi(e: FormEvent) {
    e.preventDefault();
    const valor = lerValorDigitado(valorRecebido);
    if (valor === null) {
      setErro("Digite o valor que entrou, por exemplo 1.250,00.");
      return;
    }
    if (diaRecebido === "") {
      setErro("Escolha a data em que o dinheiro entrou.");
      return;
    }
    executar(() => marcarRecebidoAction({ id: item.id, recebidoEm: diaRecebido, valor }), () => setPainel(null));
  }

  function salvarData(dia: string | null) {
    executar(() => salvarPagamentoPrevistoAction({ id: item.id, dia }), () => setPainel(null));
  }

  function marcarComissao(marcar: boolean) {
    executar(() => salvarComissaoDoItemAction({ id: item.id, percentual: marcar ? comissaoAoMarcar : null }));
  }

  function salvarComissao(texto: string) {
    const percentual = lerValorDigitado(texto.trim());
    if (percentual === null || percentual < COMISSAO_MINIMA || percentual > COMISSAO_MAXIMA) {
      setErro(`Use uma comissão de ${COMISSAO_MINIMA} a ${COMISSAO_MAXIMA}%, ou desmarque Tem comissão.`);
      return;
    }
    if (percentual === item.comissaoPercentual) {
      setErro(null);
      return;
    }
    executar(() => salvarComissaoDoItemAction({ id: item.id, percentual }));
  }

  function salvarCusto(texto: string) {
    const limpo = texto.trim();
    const custo = limpo === "" ? null : lerValorDigitado(limpo);
    if (limpo !== "" && custo === null) {
      setErro("Digite o custo em reais, por exemplo 2.700,00.");
      return;
    }
    if (custo === null ? item.custoEstimado : !item.custoEstimado && custo === item.custo) {
      setErro(null);
      return;
    }
    executar(() => salvarCustoRealAction({ id: item.id, custo }));
  }

  const recebido = item.status === "recebido";
  // Das parcelas de um contrato, só a primeira tem os controles; o resto é leitura.
  const somenteLeitura = item.parcela !== null && item.parcela.numero > 1;

  return (
    <li className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="line-clamp-2 text-sm font-medium break-words text-ink">{item.objeto || "Licitação sem descrição"}</p>
          {item.orgao ? <p className="truncate text-xs text-muted-foreground">{item.orgao}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pilula tom={TOM_STATUS[item.status]} className="gap-1">
            <IconeStatus status={item.status} />
            {ROTULO_STATUS_CAIXA[item.status]}
          </Pilula>
          {item.resultado < -0.005 ? <Pilula tom="negativo">Prejuízo</Pilula> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <p className="text-xl leading-tight font-semibold tabular-nums text-ink">{formatarMoedaCurta(item.valor)}</p>
        <p className={item.status === "atrasado" ? "text-sm text-negative" : "text-sm text-muted-foreground"}>{fraseData(item)}</p>
        {item.parcela ? (
          <p className="text-sm text-muted-foreground">
            Mês {item.parcela.numero} de {item.parcela.total}
          </p>
        ) : null}
      </div>
      {item.origemValor === "estimado" ? <p className="-mt-2 text-xs text-faint">Valor do edital; confirme o homologado.</p> : null}

      {somenteLeitura ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          Comissão {formatarMoedaCurta(item.comissao)} · dev {formatarMoedaCurta(item.dev)} · fica com você {formatarMoedaCurta(item.resultado)}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <label htmlFor={`${idBase}-tem-comissao`} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                id={`${idBase}-tem-comissao`}
                type="checkbox"
                checked={item.comissaoAjustada}
                disabled={salvando}
                onChange={(e) => marcarComissao(e.currentTarget.checked)}
                className="size-4 accent-brand"
              />
              Tem comissão
            </label>
            {item.comissaoAjustada ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    id={`${idBase}-comissao`}
                    aria-label="Comissão em porcentagem"
                    key={item.comissaoPercentual}
                    inputMode="decimal"
                    defaultValue={textoPercentual(item.comissaoPercentual)}
                    disabled={salvando}
                    onBlur={(e) => salvarComissao(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-describedby={`${idBase}-comissao-valor`}
                    className={`${CLASSE_CAMPO} w-20 text-center tabular-nums`}
                  />
                  <span aria-hidden="true">%</span>
                </div>
                <p id={`${idBase}-comissao-valor`} className="tabular-nums">
                  {formatarMoedaCurta(item.comissao)}
                </p>
              </>
            ) : null}
          </div>

          {item.dev > 0 ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              Dev {formatarMoedaCurta(item.dev)}
              {item.parcela ? " neste mês" : ""} · fica com você {formatarMoedaCurta(item.resultado)}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <label htmlFor={`${idBase}-custo`}>Custo real</label>
                <span aria-hidden="true">R$</span>
                <input
                  id={`${idBase}-custo`}
                  key={item.custoEstimado ? "estimado" : item.custo}
                  inputMode="decimal"
                  defaultValue={item.custoEstimado ? "" : String(item.custo).replace(".", ",")}
                  placeholder={String(item.custo).replace(".", ",")}
                  disabled={salvando}
                  onBlur={(e) => salvarCusto(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  aria-describedby={`${idBase}-custo-nota`}
                  className={`${CLASSE_CAMPO} w-28 text-right tabular-nums`}
                />
              </div>
              <p id={`${idBase}-custo-nota`} className="text-faint tabular-nums">
                {item.custoEstimado ? "Estimado: digite o custo real" : "Custo real informado"} · saldo {formatarMoedaCurta(item.resultado)}
              </p>
            </div>
          )}
        </>
      )}

      {painel === null && !somenteLeitura ? (
        <div className="flex flex-wrap gap-2">
          {recebido ? (
            <button
              type="button"
              disabled={salvando}
              onClick={() => executar(() => desfazerRecebidoAction(item.id))}
              className={BOTAO_SECUNDARIO}
            >
              <Undo2 aria-hidden="true" className="size-4" />
              Desfazer recebimento
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setPainel("recebi")} className={BOTAO_PRIMARIO}>
                <Check aria-hidden="true" className="size-4" />
                Recebi
              </button>
              <button type="button" onClick={() => setPainel("data")} className={BOTAO_SECUNDARIO}>
                <CalendarDays aria-hidden="true" className="size-4" />
                Mudar data
              </button>
            </>
          )}
        </div>
      ) : null}

      {painel === "recebi" ? (
        <form onSubmit={confirmarRecebi} className="flex flex-col gap-3 rounded-control border border-border bg-raised p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idBase}-dia`} className="text-sm font-medium text-ink">
                Entrou em
              </label>
              <input id={`${idBase}-dia`} type="date" value={diaRecebido} onChange={(e) => setDiaRecebido(e.target.value)} className={CLASSE_CAMPO} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idBase}-valor`} className="text-sm font-medium text-ink">
                Valor que entrou (R$)
              </label>
              <input
                id={`${idBase}-valor`}
                inputMode="decimal"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                className={`${CLASSE_CAMPO} tabular-nums`}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={salvando} className={BOTAO_PRIMARIO}>
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
            <button type="button" disabled={salvando} onClick={() => setPainel(null)} className={BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {painel === "data" ? (
        <div className="flex flex-col gap-3 rounded-control border border-border bg-raised p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idBase}-previsto`} className="text-sm font-medium text-ink">
              Pagamento previsto para
            </label>
            <input id={`${idBase}-previsto`} type="date" value={diaPrevisto} onChange={(e) => setDiaPrevisto(e.target.value)} className={CLASSE_CAMPO} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={salvando || diaPrevisto === ""} onClick={() => salvarData(diaPrevisto)} className={BOTAO_PRIMARIO}>
              {salvando ? "Salvando…" : "Salvar data"}
            </button>
            <button type="button" disabled={salvando} onClick={() => salvarData(null)} className={BOTAO_SECUNDARIO}>
              Usar o prazo do edital
            </button>
            <button type="button" disabled={salvando} onClick={() => setPainel(null)} className={BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </li>
  );
}
