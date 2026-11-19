"use client";

import { useActionState, useState } from "react";
import { CONTROLE } from "@/components/propostas/campos";
import { Interruptor } from "@/components/ui/interruptor";
import { escolhasDoPerfil, type EscolhasAlerta, type PerfilAlerta } from "@/core/whatsapp-alertas";
import { salvarPerfilAlertaAction, type EstadoPerfil } from "./actions";

const ESTADO_INICIAL: EstadoPerfil = { erro: null, ok: false };

type Caixa = Exclude<keyof EscolhasAlerta, "perfil" | "valorGrande">;

const PERFIS: ReadonlyArray<{ id: PerfilAlerta; rotulo: string; descricao: string }> = [
  { id: "operacional", rotulo: "Operacional", descricao: "Para quem toca o dia a dia: prazos, licitações novas e pendências." },
  { id: "acompanhamento", rotulo: "Acompanhamento", descricao: "Para quem só quer saber como vai: o que a equipe fez, disputas e meta." },
];

const RESUMO: ReadonlyArray<{ campo: Caixa; rotulo: string; descricao?: string }> = [
  { campo: "novas", rotulo: "Licitações novas do seu ramo", descricao: "Até 8, com valor, cidade, modalidade, quando fecha e o que bateu." },
  { campo: "fechando", rotulo: "Itens que fecham em 48 horas" },
  { campo: "aguardando", rotulo: "Itens em disputa aguardando resultado" },
  { campo: "pendencias", rotulo: "Avisos para você", descricao: "Item atribuído, proposta para revisar, ficha pendente." },
  { campo: "movimentos", rotulo: "O que a equipe movimentou no Pipeline" },
  { campo: "disputa", rotulo: "Itens que entraram em disputa" },
  { campo: "grandes", rotulo: "Licitações novas acima do valor abaixo" },
  { campo: "meta", rotulo: "Placar da meta da semana", descricao: "Quantos itens chegaram em disputa desde segunda-feira." },
];

const formatoValor = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function PerfilAlertaForm({ inicial }: { inicial: EscolhasAlerta }) {
  const [estado, acao, pendente] = useActionState(salvarPerfilAlertaAction, ESTADO_INICIAL);
  const [escolhas, setEscolhas] = useState<EscolhasAlerta>(inicial);
  const [valor, setValor] = useState(formatoValor.format(inicial.valorGrande));

  function trocarPerfil(perfil: PerfilAlerta) {
    setEscolhas((atual) => escolhasDoPerfil(perfil, atual.valorGrande));
  }

  function marcar(campo: Caixa, ligado: boolean) {
    setEscolhas((atual) => ({ ...atual, [campo]: ligado }));
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Perfil</legend>
        {PERFIS.map((p) => (
          <label
            key={p.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border px-3 py-2 has-checked:border-brand"
          >
            <input
              type="radio"
              name="perfil"
              value={p.id}
              checked={escolhas.perfil === p.id}
              onChange={() => trocarPerfil(p.id)}
              className="mt-1 size-4 accent-brand"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-ink">{p.rotulo}</span>
              <span className="text-[13px] text-muted-foreground">{p.descricao}</span>
            </span>
          </label>
        ))}
        <p className="text-[13px] text-muted-foreground">Trocar o perfil volta as caixinhas para o padrão dele. Depois ajuste como quiser.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-ink">Na hora</legend>
        <Interruptor
          name="prazos"
          checked={escolhas.prazos}
          onChange={(e) => marcar("prazos", e.target.checked)}
          rotulo="Prazo urgente dos itens do Pipeline"
          descricao="24 horas e 2 horas antes de fechar. É o único aviso que chega fora do resumo."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-ink">No resumo das 7h</legend>
        {RESUMO.map((c) => (
          <Interruptor
            key={c.campo}
            name={c.campo}
            checked={escolhas[c.campo]}
            onChange={(e) => marcar(c.campo, e.target.checked)}
            rotulo={c.rotulo}
            descricao={c.descricao}
          />
        ))}
        <div className="flex flex-col gap-1.5 pl-[60px]">
          <label htmlFor="valor-grande" className="text-[13px] font-medium text-ink">
            Valor a partir do qual a licitação é grande (R$)
          </label>
          <input
            id="valor-grande"
            name="valorGrande"
            inputMode="numeric"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={!escolhas.grandes}
            className={`${CONTROLE} max-w-[200px] disabled:opacity-50`}
          />
          {!escolhas.grandes ? <input type="hidden" name="valorGrande" value={valor} /> : null}
        </div>
      </fieldset>

      {estado.erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-[13px] text-positive">
          Preferências salvas.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit"
      >
        {pendente ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
