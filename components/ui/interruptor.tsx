import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role" | "className" | "children" | "id"> {
  /** Texto principal; clicar nele também liga e desliga. */
  rotulo: ReactNode;
  /** Texto de apoio abaixo do rótulo (lido por leitores de tela como descrição). */
  descricao?: ReactNode;
  /** Classes extras no contêiner (o rótulo inteiro). */
  className?: string;
}

/**
 * Interruptor (liga e desliga) feito sobre um input checkbox: funciona em formulários
 * comuns e com server actions (`name`, `value`, `checked` ou `defaultChecked`) como a caixa de marcar.
 * Trilho cinza desligado, laranja ligado, linha inteira com no mínimo 44px de altura para o toque.
 */
export function Interruptor({ rotulo, descricao, className, ...resto }: Props) {
  const idDescricao = useId();
  return (
    <label
      className={cn(
        "flex min-h-11 min-w-0 cursor-pointer items-center gap-3 py-1 text-sm text-ink has-disabled:cursor-not-allowed",
        className,
      )}
    >
      <input
        {...resto}
        type="checkbox"
        role="switch"
        aria-describedby={descricao ? idDescricao : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-control bg-raised transition-colors duration-200 peer-checked:border-transparent peer-checked:bg-brand-fill peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ground peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-[22px] after:rounded-full after:bg-muted-foreground after:shadow-sm peer-checked:after:bg-white after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
      <span className="flex min-w-0 flex-col gap-0.5 break-words peer-disabled:opacity-60">
        <span>{rotulo}</span>
        {descricao ? (
          <span id={idDescricao} className="text-[13px] text-muted-foreground">
            {descricao}
          </span>
        ) : null}
      </span>
    </label>
  );
}
