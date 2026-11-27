import Link from "next/link";
import { agruparOferta } from "@/core/oferta";
import { cn } from "@/lib/utils";

interface Props {
  /** Termos do foco da empresa (perfil.foco) */
  foco: ReadonlyArray<string>;
  className?: string;
}

const CLASSE_SELO = "inline-flex min-h-7 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-ink";
const CLASSE_LINK =
  "inline-flex min-h-11 items-center rounded-control px-2 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand md:min-h-8";

/** Faixa acima da lista do Radar: o que a empresa oferece, vindo do foco, com atalho para editar. */
export function FaixaOferta({ foco, className }: Props) {
  const selos = agruparOferta(foco);
  return (
    <section aria-label="O que você oferece" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {selos.length > 0 ? (
        <>
          <h2 className="text-[13px] font-semibold text-ink">Você oferece:</h2>
          {/* Uma linha só: o nome do grupo no selo, os termos no title. */}
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {selos.map((selo) => (
              <li key={selo.grupo} title={selo.termos.join(", ")} className={CLASSE_SELO}>
                {selo.grupo === "Outros" ? `+${selo.termos.length}` : selo.grupo}
              </li>
            ))}
          </ul>
          <Link href="/empresa#foco" className={CLASSE_LINK}>
            Editar
          </Link>
        </>
      ) : (
        <Link href="/empresa#foco" className={`${CLASSE_SELO} border-dashed text-brand hover:underline`}>
          Defina o que você oferece
        </Link>
      )}
    </section>
  );
}
