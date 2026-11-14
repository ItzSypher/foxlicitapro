"use client";

import { useState, useTransition } from "react";
import { adicionarPrecoAction } from "@/app/(app)/fornecedores/actions";
import { parseNumeroBR } from "@/components/calculadora/numero";
import { BOTAO_PRIMARIO, CONTROLE } from "./estilo";

type Aviso = { tom: "ok" | "erro"; texto: string } | null;

/** Registra à mão um preço que o fornecedor passou. */
export function NovoPreco({ fornecedorId }: { fornecedorId: string }) {
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [preco, setPreco] = useState("");
  const [prazo, setPrazo] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, iniciar] = useTransition();

  function salvar(): void {
    const valor = parseNumeroBR(preco);
    if (valor === null || !Number.isFinite(valor) || valor < 0) {
      setAviso({ tom: "erro", texto: "Informe um preço válido." });
      return;
    }
    const dias = prazo.trim() === "" ? null : Number(prazo.trim());
    if (dias !== null && (!Number.isInteger(dias) || dias < 0)) {
      setAviso({ tom: "erro", texto: "O prazo é em dias inteiros." });
      return;
    }
    setAviso(null);
    iniciar(async () => {
      const r = await adicionarPrecoAction(fornecedorId, { descricao, unidade, preco: valor, prazoDias: dias });
      if (!r.ok) {
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      setDescricao("");
      setPreco("");
      setPrazo("");
      setAviso({ tom: "ok", texto: "Preço registrado." });
    });
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        salvar();
      }}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3"
    >
      <h3 className="text-sm font-semibold text-ink">Registrar preço</h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="preco-descricao" className="text-[13px] font-medium text-ink">
          Item
        </label>
        <input
          id="preco-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Ex.: Monitor 24 polegadas"
          className={CONTROLE}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preco-valor" className="text-[13px] font-medium text-ink">
            Preço (R$)
          </label>
          <input
            id="preco-valor"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            className={`${CONTROLE} tabular-nums`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preco-unidade" className="text-[13px] font-medium text-ink">
            Unidade
          </label>
          <input
            id="preco-unidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            maxLength={20}
            autoComplete="off"
            className={CONTROLE}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preco-prazo" className="text-[13px] font-medium text-ink">
            Prazo (dias)
          </label>
          <input
            id="preco-prazo"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className={`${CONTROLE} tabular-nums`}
          />
        </div>
      </div>
      <button type="submit" disabled={salvando} className={BOTAO_PRIMARIO}>
        {salvando ? "Salvando…" : "Registrar preço"}
      </button>
      <p
        role={aviso?.tom === "erro" ? "alert" : "status"}
        className={aviso?.tom === "erro" ? "min-h-5 text-[13px] text-negative" : "min-h-5 text-[13px] text-positive"}
      >
        {aviso?.texto ?? ""}
      </p>
    </form>
  );
}
