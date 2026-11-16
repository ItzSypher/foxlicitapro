"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpcaoSeletor<T extends string = string> {
  valor: T;
  rotulo: string;
  desabilitada?: boolean;
}

interface Props<T extends string> {
  valor: T;
  aoMudar: (valor: T) => void;
  opcoes: ReadonlyArray<OpcaoSeletor<T>>;
  /** Rótulo em texto pequeno. Sem ele, passe `rotuloAcessivel` ou ligue um <label htmlFor={id}> de fora. */
  rotulo?: string;
  /** "acima" (padrão), "lado" (na mesma linha, para barras de filtro) ou "oculto" (só leitor de tela). */
  posicaoRotulo?: "acima" | "lado" | "oculto";
  /** Nome para leitor de tela quando não há rótulo visível. */
  rotuloAcessivel?: string;
  /** Com `name`, o valor vai num input oculto e o seletor funciona dentro de um <form> (server actions). */
  name?: string;
  /** Vai para o gatilho; serve para um <label htmlFor> externo. */
  id?: string;
  /** Mostrado quando `valor` não casa com nenhuma opção (por exemplo, "Escolha o estado"). */
  placeholder?: string;
  desabilitado?: boolean;
  obrigatorio?: boolean;
  invalido?: boolean;
  /** id do texto de dica ou de erro, lido junto pelo leitor de tela. */
  descritoPor?: string;
  /** Classes do contêiner (largura, margem). O gatilho sempre ocupa a largura do contêiner. */
  className?: string;
}

/**
 * Seletor sobre o Select do Base UI: gatilho de 44px no toque e 36px no computador, em degrau de tom,
 * lista flutuante (a única coisa com sombra) com a opção ativa marcada em laranja. Teclado:
 * setas, Home, End, digitar para buscar, Enter e Esc. Largura limitada à tela, cabe em 375px.
 */
export function Seletor<T extends string>({
  valor,
  aoMudar,
  opcoes,
  rotulo,
  posicaoRotulo = "acima",
  rotuloAcessivel,
  name,
  id,
  placeholder,
  desabilitado = false,
  obrigatorio = false,
  invalido = false,
  descritoPor,
  className,
}: Props<T>) {
  const atual = opcoes.find((o) => o.valor === valor);
  const rotuloVisivel = rotulo !== undefined && posicaoRotulo !== "oculto";
  const nomeDoGatilho = rotuloVisivel ? undefined : (rotuloAcessivel ?? rotulo);

  return (
    <Select.Root<T>
      value={valor}
      onValueChange={(novo) => {
        if (novo !== null) aoMudar(novo);
      }}
      name={name}
      required={obrigatorio}
      disabled={desabilitado}
    >
      <div
        className={cn(
          "flex min-w-0",
          posicaoRotulo === "lado" ? "flex-row items-center gap-2" : "flex-col gap-1",
          className,
        )}
      >
        {rotuloVisivel ? (
          <Select.Label className="shrink-0 text-xs text-muted-foreground">{rotulo}</Select.Label>
        ) : null}
        <Select.Trigger
          id={id}
          aria-label={nomeDoGatilho}
          aria-invalid={invalido || undefined}
          aria-describedby={descritoPor}
          className="group inline-flex h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-control bg-raised px-3 text-left text-sm text-ink ring-1 ring-inset ring-border outline-none transition-colors hover:bg-active focus-visible:ring-2 focus-visible:ring-brand data-popup-open:bg-active data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:ring-nogo lg:h-9"
        >
          <Select.Value className={cn("min-w-0 truncate", atual === undefined && "text-muted-foreground")}>
            {atual?.rotulo ?? placeholder ?? ""}
          </Select.Value>
          <Select.Icon className="shrink-0 text-faint transition-transform group-data-popup-open:rotate-180">
            <ChevronDown aria-hidden="true" className="size-4" />
          </Select.Icon>
        </Select.Trigger>
      </div>

      <Select.Portal>
        <Select.Positioner
          alignItemWithTrigger={false}
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-[60] outline-none"
        >
          <Select.Popup data-seletor-popup="" className="max-h-(--available-height) min-w-(--anchor-width) max-w-[min(var(--available-width),22rem)] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-card bg-popover p-1 text-sm text-popover-foreground shadow-[0_10px_30px_-8px_rgb(0_0_0/0.35)] ring-1 ring-border outline-none transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Select.List className="outline-none">
              {opcoes.map((o) => (
                <Select.Item
                  key={o.valor}
                  value={o.valor}
                  label={o.rotulo}
                  disabled={o.desabilitada}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-ink outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-active data-selected:font-medium data-selected:text-brand lg:min-h-9"
                >
                  <Select.ItemText className="min-w-0 flex-1">{o.rotulo}</Select.ItemText>
                  <Select.ItemIndicator className="inline-flex size-4 shrink-0 items-center justify-center">
                    <Check aria-hidden="true" className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
