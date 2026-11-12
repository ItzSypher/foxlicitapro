"use client";

import type { ModalidadeId, Score } from "@/core/types";
import { InfoDica } from "@/components/ui/info-dica";
import { EXPLICACAO_CRITERIO, EXPLICACAO_FAIXA, GLOSSARIO, type ChaveGlossario } from "@/lib/glossario";
import { cn } from "@/lib/utils";

const FAIXAS_NA_ORDEM = ["go", "atencao", "nogo"] as const;

/** Balão "i" da nota: os 5 critérios com pontos/máximo, o que cada faixa significa e os alertas. */
export function DicaNota({ score, className }: { score: Score; className?: string }) {
  return (
    <InfoDica rotulo="Como a nota é calculada" className={className}>
      <p className="font-semibold">Como a nota é calculada</p>
      <p className="mt-0.5 text-muted-foreground">
        Soma de 5 critérios, de 0 a 100. Esta oportunidade fez {score.total}.
      </p>

      <ul className="mt-2.5 flex flex-col gap-2">
        {score.criterios.map((criterio) => (
          <li key={criterio.id}>
            <span className="flex items-baseline justify-between gap-3 font-medium">
              <span>{criterio.rotulo}</span>
              <span className="font-mono tabular-nums">
                {criterio.pontos}/{criterio.maximo}
              </span>
            </span>
            <span className="block text-muted-foreground">{EXPLICACAO_CRITERIO[criterio.id]}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 font-semibold">O que a faixa significa</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {FAIXAS_NA_ORDEM.map((faixa) => {
          const info = EXPLICACAO_FAIXA[faixa];
          return (
            <li key={faixa} className={cn(score.faixa === faixa ? "font-medium" : "text-muted-foreground")}>
              {info.rotulo}, {info.intervalo}. {info.frase}
            </li>
          );
        })}
      </ul>

      {score.alertas && score.alertas.length > 0 ? (
        <>
          <p className="mt-3 font-semibold">Alertas desta oportunidade</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-warning">
            {score.alertas.map((alerta) => (
              <li key={alerta}>{alerta}</li>
            ))}
          </ul>
        </>
      ) : null}
    </InfoDica>
  );
}

/** Balão "i" com uma definição do glossário. */
export function DicaGlossario({
  chave,
  rotulo,
  className,
}: {
  chave: ChaveGlossario;
  rotulo?: string;
  className?: string;
}) {
  return (
    <InfoDica rotulo={rotulo} className={className}>
      <p>{GLOSSARIO[chave]}</p>
    </InfoDica>
  );
}

/** Balão "i" da modalidade: explica Dispensa e Pregão e destaca a desta oportunidade. */
export function DicaModalidade({ modalidadeId, className }: { modalidadeId: ModalidadeId; className?: string }) {
  const ehDispensa = modalidadeId === 8;
  return (
    <InfoDica rotulo="O que é esta modalidade?" className={className}>
      <p className={cn(ehDispensa ? "font-medium" : "text-muted-foreground")}>{GLOSSARIO.dispensa}</p>
      <p className={cn("mt-2", ehDispensa ? "text-muted-foreground" : "font-medium")}>{GLOSSARIO.pregao}</p>
    </InfoDica>
  );
}

/** Balão "i" do valor estimado: teto do órgão e deságio. */
export function DicaValor({ className }: { className?: string }) {
  return (
    <InfoDica rotulo="O que é o valor estimado?" className={className}>
      <p>
        Valor estimado: o quanto o órgão calcula gastar. Ele funciona como teto, e o seu preço não pode passar dele.
      </p>
      <p className="mt-2 text-muted-foreground">{GLOSSARIO.desagio}</p>
    </InfoDica>
  );
}
