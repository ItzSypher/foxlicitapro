import { cn } from "@/lib/utils";

/** 16px no texto: abaixo disso o iOS dá zoom ao focar. */
export const CONTROLE =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-nogo";

interface CampoBase {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (valor: string) => void;
  dica?: string;
  className?: string;
}

function Dica({ id, dica }: { id: string; dica?: string }) {
  if (!dica) return null;
  return (
    <p id={`${id}-dica`} className="text-[13px] text-muted-foreground">
      {dica}
    </p>
  );
}

export function CampoLinha({
  id,
  rotulo,
  valor,
  onMudar,
  dica,
  className,
  maxLength = 200,
  inputMode,
}: CampoBase & { maxLength?: number; inputMode?: "text" | "numeric" | "decimal" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={valor}
        maxLength={maxLength}
        autoComplete="off"
        aria-describedby={dica ? `${id}-dica` : undefined}
        onChange={(e) => onMudar(e.target.value)}
        className={CONTROLE}
      />
      <Dica id={id} dica={dica} />
    </div>
  );
}

export function CampoArea({
  id,
  rotulo,
  valor,
  onMudar,
  dica,
  className,
  linhas = 3,
  maxLength = 2000,
}: CampoBase & { linhas?: number; maxLength?: number }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <textarea
        id={id}
        value={valor}
        rows={linhas}
        maxLength={maxLength}
        aria-describedby={dica ? `${id}-dica` : undefined}
        onChange={(e) => onMudar(e.target.value)}
        className={cn(CONTROLE, "h-auto min-h-11 resize-y py-2.5 leading-snug")}
      />
      <Dica id={id} dica={dica} />
    </div>
  );
}

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

export const BOTAO_ICONE =
  "inline-flex size-11 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-active hover:text-ink focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-30";
