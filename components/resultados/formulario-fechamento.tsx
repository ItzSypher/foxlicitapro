"use client";

import { useId, useState, useTransition } from "react";
import { registrarFechamento } from "@/app/(app)/pipeline/actions";
import { formatarNumeroBR, parseNumeroBR } from "@/components/calculadora/numero";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import { MOTIVOS_PERDA, ROTULO_MOTIVO, calcularLucro, ehMotivoPerda, type MotivoPerda } from "@/core/fechamento";
import { formatarMoeda, formatarPercentual } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  etapa: "ganha" | "perdida";
  /** Valor homologado já gravado, ou o da proposta ou estimado para partir de um número */
  valorInicial: number | null;
  custoInicial: number | null;
  motivoInicial: MotivoPerda | null;
  /** Texto do botão que sai sem gravar: "Pular" ao fechar no pipeline, "Cancelar" ao editar */
  rotuloSaida: string;
  /** `salvou` é verdadeiro depois de gravar; falso ao sair sem gravar */
  aoConcluir: (salvou: boolean) => void;
}

function campoNumero(texto: string): { valor: number | null; erro: boolean } {
  const lido = parseNumeroBR(texto);
  if (lido === null) return { valor: null, erro: false };
  if (Number.isNaN(lido) || lido < 0) return { valor: null, erro: true };
  return { valor: lido, erro: false };
}

function paraCampo(valor: number | null): string {
  return valor === null ? "" : formatarNumeroBR(valor, 2);
}

/** Valor homologado e custo real (com lucro e margem ao vivo) para ganhas; motivo para perdidas. */
export function FormularioFechamento({ itemId, etapa, valorInicial, custoInicial, motivoInicial, rotuloSaida, aoConcluir }: Props) {
  const id = useId();
  const [valor, setValor] = useState(paraCampo(valorInicial));
  const [custo, setCusto] = useState(paraCampo(custoInicial));
  const [motivo, setMotivo] = useState<string>(motivoInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const lidoValor = campoNumero(valor);
  const lidoCusto = campoNumero(custo);
  const { lucro, margem } = calcularLucro(lidoValor.valor ?? 0, lidoCusto.valor);

  function salvar() {
    if (etapa === "ganha" && (lidoValor.erro || lidoCusto.erro)) {
      setErro("Confira os valores: use só números, como 12.500,00.");
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await registrarFechamento(itemId, {
        valorHomologado: etapa === "ganha" ? lidoValor.valor : null,
        custoReal: etapa === "ganha" ? lidoCusto.valor : null,
        motivoPerda: etapa === "perdida" && ehMotivoPerda(motivo) ? motivo : null,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      aoConcluir(true);
    });
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      {etapa === "ganha" ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${id}-valor`} className="text-[13px] text-muted-foreground">
                Valor homologado (R$)
              </label>
              <input
                id={`${id}-valor`}
                inputMode="decimal"
                autoComplete="off"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-invalid={lidoValor.erro}
                className={cn(CONTROLE, "tabular-nums")}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${id}-custo`} className="text-[13px] text-muted-foreground">
                Custo real (R$)
              </label>
              <input
                id={`${id}-custo`}
                inputMode="decimal"
                autoComplete="off"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                aria-invalid={lidoCusto.erro}
                className={cn(CONTROLE, "tabular-nums")}
              />
            </div>
          </div>
          <p aria-live="polite" className="rounded-control border border-border bg-raised px-3 py-2 text-sm">
            {lucro === null ? (
              <span className="text-muted-foreground">Informe o custo para ver o lucro e a margem.</span>
            ) : (
              <span className={cn("font-medium tabular-nums", lucro < 0 ? "text-negative" : "text-positive")}>
                Lucro {formatarMoeda(lucro)}
                {margem === null ? "" : ` · margem ${formatarPercentual(margem)}`}
              </span>
            )}
          </p>
        </>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-motivo`} className="text-[13px] text-muted-foreground">
            Motivo (opcional)
          </label>
          <select id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={CONTROLE}>
            <option value="">Não informar</option>
            {MOTIVOS_PERDA.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MOTIVO[m]}
              </option>
            ))}
          </select>
        </div>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={pendente} onClick={() => aoConcluir(false)} className={BOTAO_SECUNDARIO}>
          {rotuloSaida}
        </button>
        <button type="submit" disabled={pendente} className={BOTAO_PRIMARIO}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
