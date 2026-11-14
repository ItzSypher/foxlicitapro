import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** 16px no texto: abaixo disso o iOS dá zoom ao focar. */
const CONTROLE =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink placeholder:text-faint outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 aria-invalid:border-nogo";

interface CampoBase {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
}

function Rodape({ id, erro, dica }: Pick<CampoBase, "id" | "erro" | "dica">) {
  if (erro) {
    return (
      <p id={`${id}-erro`} role="alert" className="text-[13px] text-negative">
        {erro}
      </p>
    );
  }
  if (dica) {
    return (
      <p id={`${id}-dica`} className="text-[13px] text-muted-foreground">
        {dica}
      </p>
    );
  }
  return null;
}

function descricaoDe({ id, erro, dica }: Pick<CampoBase, "id" | "erro" | "dica">): string | undefined {
  if (erro) return `${id}-erro`;
  if (dica) return `${id}-dica`;
  return undefined;
}

interface CampoTextoProps extends CampoBase {
  valor: string;
  onMudar: (valor: string) => void;
  placeholder?: string;
}

export function CampoTexto({ id, rotulo, erro, dica, valor, onMudar, placeholder }: CampoTextoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        value={valor}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={300}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricaoDe({ id, erro, dica })}
        onChange={(e) => onMudar(e.target.value)}
        className={CONTROLE}
      />
      <Rodape id={id} erro={erro} dica={dica} />
    </div>
  );
}

interface CampoNumeroProps extends CampoBase {
  valor: string;
  onMudar: (valor: string) => void;
  prefixo?: string;
  sufixo?: string;
  placeholder?: string;
}

/** Texto com teclado decimal; "1.234,56" e "1234.56" são lidos por parseNumeroBR. */
export function CampoNumero({ id, rotulo, erro, dica, valor, onMudar, prefixo, sufixo, placeholder }: CampoNumeroProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <div className="relative">
        {prefixo && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-faint">
            {prefixo}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          value={valor}
          placeholder={placeholder}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricaoDe({ id, erro, dica })}
          onChange={(e) => onMudar(e.target.value)}
          className={cn(CONTROLE, "tabular-nums", prefixo && "pl-10", sufixo && "pr-9")}
        />
        {sufixo && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-faint">
            {sufixo}
          </span>
        )}
      </div>
      <Rodape id={id} erro={erro} dica={dica} />
    </div>
  );
}

interface CampoSelectProps extends CampoBase {
  valor: string;
  onMudar: (valor: string) => void;
  opcoes: readonly { valor: string; rotulo: string }[];
  vazio: string;
}

export function CampoSelect({ id, rotulo, erro, dica, valor, onMudar, opcoes, vazio }: CampoSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricaoDe({ id, erro, dica })}
          onChange={(e) => onMudar(e.target.value)}
          className={cn(CONTROLE, "appearance-none pr-10")}
        >
          <option value="">{vazio}</option>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <Rodape id={id} erro={erro} dica={dica} />
    </div>
  );
}

interface SegmentadoProps<T extends string> {
  nome: string;
  rotulo: string;
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  onMudar: (valor: T) => void;
}

export function Segmentado<T extends string>({ nome, rotulo, valor, opcoes, onMudar }: SegmentadoProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink">{rotulo}</legend>
      <div className="flex gap-1 rounded-control border border-control bg-raised p-0.5">
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[5px] text-sm text-muted-foreground has-checked:bg-brand has-checked:font-medium has-checked:text-black has-focus-visible:ring-2 has-focus-visible:ring-brand/60"
          >
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => onMudar(o.valor)}
              className="sr-only"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
