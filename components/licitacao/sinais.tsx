import { Pilula } from "@/components/radar/pilula";
import { cn } from "@/lib/utils";
import type { Sinal, TomSinal } from "./dominio";
import { Colapsavel } from "./colapsavel";

const PONTO: Record<TomSinal, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
};

const LEGENDA: Record<TomSinal, string> = {
  positive: "Favorável",
  warning: "Atenção",
  negative: "Problema",
};

function contar(sinais: readonly Sinal[], tom: TomSinal): number {
  return sinais.filter((s) => s.tom === tom).length;
}

export function Sinais({ sinais }: { sinais: readonly Sinal[] }) {
  const favoraveis = contar(sinais, "positive");
  const atencao = contar(sinais, "warning");
  const problemas = contar(sinais, "negative");
  return (
    <Colapsavel
      id="sinais"
      titulo="Sinais para o seu perfil"
      selos={
        <>
          {favoraveis > 0 ? <Pilula tom="positivo">{favoraveis} {favoraveis === 1 ? "favorável" : "favoráveis"}</Pilula> : null}
          {atencao > 0 ? <Pilula tom="aviso">{atencao} {atencao === 1 ? "atenção" : "atenções"}</Pilula> : null}
          {problemas > 0 ? <Pilula tom="negativo">{problemas} {problemas === 1 ? "problema" : "problemas"}</Pilula> : null}
          {sinais.length === 0 ? <Pilula tom="neutro">Sem sinais</Pilula> : null}
        </>
      }
    >
      <ul className="flex flex-col">
        {sinais.map((s) => (
          <li key={s.id} className="flex items-start gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
            <span aria-hidden="true" className={cn("mt-[7px] size-2 shrink-0 rounded-full", PONTO[s.tom])} />
            <span className="text-sm leading-snug wrap-break-word text-ink">
              <span className="sr-only">{LEGENDA[s.tom]}: </span>
              {s.texto}
            </span>
          </li>
        ))}
      </ul>
    </Colapsavel>
  );
}
