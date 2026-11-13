"use client";

import {
  PAPEIS,
  PERMISSOES,
  ROTULO_PAPEL,
  ROTULO_PERMISSAO,
  permissoesPadrao,
  type Permissao,
} from "@/core/permissoes";
import type { Papel } from "@/core/types-equipe";
import { CONTROLE } from "@/components/propostas/campos";

export interface ValorAcesso {
  papel: Papel;
  permissoes: Permissao[];
  limite: number;
}

/** Valor inicial ao escolher um papel: as permissões padrão dele e o limite de 3. */
export function acessoPadrao(papel: Papel, limite = 3): ValorAcesso {
  return { papel, permissoes: permissoesPadrao(papel), limite };
}

/**
 * Papel, permissões (caixas de marcar) e limite diário do assistente.
 * Com `nomeados`, também envia os valores no formulário (name="papel", "permissoes", "limite").
 */
export function CamposAcesso({
  prefixo,
  valor,
  aoMudar,
  nomeados,
}: {
  prefixo: string;
  valor: ValorAcesso;
  aoMudar: (novo: ValorAcesso) => void;
  nomeados: boolean;
}) {
  const ehDono = valor.papel === "dono";

  function alternar(p: Permissao, marcado: boolean) {
    const sem = valor.permissoes.filter((x) => x !== p);
    aoMudar({ ...valor, permissoes: marcado ? [...sem, p] : sem });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixo}-papel`} className="text-[13px] font-medium text-ink">
          Papel
        </label>
        <select
          id={`${prefixo}-papel`}
          name={nomeados ? "papel" : undefined}
          value={valor.papel}
          onChange={(e) => {
            const papel = PAPEIS.find((p) => p === e.target.value);
            if (papel) aoMudar({ ...valor, papel, permissoes: permissoesPadrao(papel) });
          }}
          className={CONTROLE}
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </select>
      </div>

      {ehDono ? (
        <p className="text-[13px] text-muted-foreground">O dono pode tudo e não tem limite no assistente.</p>
      ) : (
        <>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[13px] font-medium text-ink">O que a pessoa pode fazer</legend>
            {PERMISSOES.map((p) => (
              <label key={p} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name={nomeados ? "permissoes" : undefined}
                  value={p}
                  checked={valor.permissoes.includes(p)}
                  onChange={(e) => alternar(p, e.target.checked)}
                  className="size-5 shrink-0 accent-brand-fill"
                />
                {ROTULO_PERMISSAO[p]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${prefixo}-limite`} className="text-[13px] font-medium text-ink">
              Propostas por dia com o assistente
            </label>
            <input
              id={`${prefixo}-limite`}
              name={nomeados ? "limite" : undefined}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={Number.isFinite(valor.limite) ? valor.limite : ""}
              onChange={(e) => aoMudar({ ...valor, limite: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
              className={CONTROLE}
            />
          </div>
        </>
      )}
      {ehDono && nomeados ? <input type="hidden" name="limite" value={valor.limite} /> : null}
    </div>
  );
}
