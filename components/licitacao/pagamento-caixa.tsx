"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pilula } from "@/components/radar/pilula";
import { formatarNumeroBR, parseNumeroBR } from "@/components/calculadora/numero";
import { calcularCaixa, type LimitesCaixa } from "@/core/caixa";
import { formatarMoeda } from "@/lib/formato";
import { Colapsavel } from "./colapsavel";

export interface PrazosDaFicha {
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  medicaoMensal: boolean | null;
  pagamentoAntecipado: boolean | null;
}

interface Props {
  numeroControle: string;
  /** Custo (custo + frete + extras) da última cotação salva deste item; null sem cotação */
  custoCotado: number | null;
  /** Ex.: "cotação de 10/11" */
  origemCusto: string | null;
  /** Prazos lidos no edital; null sem ficha */
  prazos: PrazosDaFicha | null;
  valorEstimado: number | null;
  limites: LimitesCaixa;
  /** Instante do pedido (ms): a data de recebimento parte dele */
  agoraInicial: number;
}

const CAMPO =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-nogo";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

function lerNumero(texto: string): number | null {
  const n = parseNumeroBR(texto);
  return n === null || Number.isNaN(n) || n < 0 ? null : n;
}

function Campo({
  id,
  rotulo,
  valor,
  onMudar,
  dica,
  modo = "decimal",
  placeholder,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  dica?: string;
  modo?: "decimal" | "numeric";
  placeholder?: string;
}) {
  const invalido = valor.trim() !== "" && Number.isNaN(parseNumeroBR(valor));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        inputMode={modo}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalido}
        className={CAMPO}
      />
      {dica ? <p className="text-[13px] text-muted-foreground">{dica}</p> : null}
    </div>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-ground p-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-xl leading-tight font-semibold tabular-nums text-ink wrap-break-word sm:text-2xl">{valor}</span>
      {detalhe ? <span className="text-[13px] leading-snug text-muted-foreground">{detalhe}</span> : null}
    </div>
  );
}

/** Quanto dinheiro sai, por quantos dias e quando volta. Custo da cotação (ou digitado) e prazos da ficha (ou digitados). */
export function PagamentoCaixa({ numeroControle, custoCotado, origemCusto, prazos, valorEstimado, limites, agoraInicial }: Props) {
  const [custo, setCusto] = useState(custoCotado === null ? "" : formatarNumeroBR(custoCotado));
  const [entrega, setEntrega] = useState(prazos?.prazoEntregaDias == null ? "" : String(prazos.prazoEntregaDias));
  const [pagamento, setPagamento] = useState(prazos?.prazoPagamentoDias == null ? "" : String(prazos.prazoPagamentoDias));
  const [mensal, setMensal] = useState(prazos?.medicaoMensal === true);
  const [meses, setMeses] = useState("12");

  const r = useMemo(
    () =>
      calcularCaixa({
        custoTotal: lerNumero(custo),
        prazoEntregaDias: lerNumero(entrega),
        prazoPagamentoDias: lerNumero(pagamento),
        medicaoMensal: mensal,
        pagamentoAntecipado: prazos?.pagamentoAntecipado ?? null,
        valorContrato: valorEstimado,
        mesesContrato: lerNumero(meses),
        inicio: new Date(agoraInicial),
        limites,
      }),
    [custo, entrega, pagamento, mensal, meses, prazos, valorEstimado, limites, agoraInicial],
  );

  const semFicha = prazos === null;
  const ex = r.avaliacao;

  return (
    <Colapsavel
      id="caixa"
      titulo="Pagamento e caixa"
      aberta
      selos={
        ex.excede ? (
          <Pilula tom="negativo">Pede mais caixa do que você definiu</Pilula>
        ) : r.diasParado !== null && r.capital !== null ? (
          <Pilula tom="positivo">Cabe nos seus limites</Pilula>
        ) : (
          <Pilula tom="neutro">Falta dado para fechar a conta</Pilula>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {ex.excede ? (
          <ul role="alert" className="flex flex-col gap-1 rounded-card border border-nogo bg-pill-neg-bg p-3 text-sm text-pill-neg-fg">
            <li className="font-semibold">Pede mais caixa do que você definiu</li>
            {ex.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="caixa-custo"
            rotulo="Custo a pagar antes de receber (R$)"
            valor={custo}
            onMudar={setCusto}
            placeholder="Ex.: 8500"
            dica={
              custoCotado !== null && origemCusto
                ? `Veio da ${origemCusto}. Pode ajustar.`
                : "Sem cotação salva. Digite o custo ou cote na calculadora."
            }
          />
          <div className="flex flex-col justify-end">
            <Link
              href={`/calculadora?item=${encodeURIComponent(numeroControle)}`}
              className="inline-flex h-11 items-center justify-center rounded-control border border-control px-4 text-sm font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              Cotar na calculadora
            </Link>
          </div>
          <Campo
            id="caixa-entrega"
            rotulo="Prazo de entrega (dias)"
            valor={entrega}
            onMudar={setEntrega}
            modo="numeric"
            placeholder="Ex.: 15"
            dica={semFicha ? "Sem ficha do edital: preencha à mão ou leia o edital na seção Ficha." : "Da ficha do edital. Pode ajustar."}
          />
          <Campo
            id="caixa-pagamento"
            rotulo="Prazo de pagamento (dias)"
            valor={pagamento}
            onMudar={setPagamento}
            modo="numeric"
            placeholder="Ex.: 30"
          />
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input type="checkbox" checked={mensal} onChange={(e) => setMensal(e.target.checked)} className="size-5 accent-brand" />
          Receita mensal (medição todo mês)
        </label>
        {mensal ? (
          <div className="sm:max-w-xs">
            <Campo id="caixa-meses" rotulo="Duração do contrato (meses)" valor={meses} onMudar={setMeses} modo="numeric" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Numero
            rotulo="Capital necessário"
            valor={r.capital === null ? "—" : formatarMoeda(r.capital.valor)}
            detalhe={r.capital?.fonte === "estimado" ? "Estimado: 80% do valor do edital" : undefined}
          />
          <Numero
            rotulo="Dias com dinheiro parado"
            valor={r.diasParado === null ? "—" : String(r.diasParado)}
            detalhe={r.giro.nivel === null ? "Informe os dois prazos" : undefined}
          />
          <Numero
            rotulo="Recebimento provável"
            valor={r.dataRecebimento === null ? "—" : fmtData.format(new Date(r.dataRecebimento))}
            detalhe={r.dataRecebimento === null ? undefined : "Contando a partir de hoje"}
          />
          {r.receitaMensal ? (
            <Numero
              rotulo="Valor mensal estimado"
              valor={r.valorMensal === null ? "—" : formatarMoeda(r.valorMensal)}
              detalhe={`${r.mesesContrato} meses`}
            />
          ) : (
            <Numero rotulo="Valor do contrato" valor={r.totalContrato === null ? "—" : formatarMoeda(r.totalContrato)} />
          )}
          {r.receitaMensal ? (
            <div className="col-span-2">
              <Numero rotulo="Total do contrato" valor={r.totalContrato === null ? "—" : formatarMoeda(r.totalContrato)} />
            </div>
          ) : null}
        </div>

        <p className="text-[13px] leading-snug text-muted-foreground">{r.giro.motivo}</p>
        {r.faltando.length > 0 ? (
          <p className="text-[13px] leading-snug text-muted-foreground">
            Falta: {r.faltando.map((f) => (f === "custo" ? "custo" : "prazos")).join(" e ")}.
          </p>
        ) : null}
      </div>
    </Colapsavel>
  );
}
