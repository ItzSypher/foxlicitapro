/** 16px no texto: abaixo disso o iOS dá zoom ao focar. */
export const CONTROLE =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-nogo";

export function Secao({
  id,
  titulo,
  children,
  acao,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-ink">
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export const BOTAO_SECUNDARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control bg-raised px-4 text-sm font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50";

export const BOTAO_PRIMARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:pointer-events-none disabled:opacity-50";
