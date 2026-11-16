"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FormularioFechamento } from "@/components/resultados/formulario-fechamento";
import { CLASSE_FOLHA, useColunas } from "./midia";

export interface FechamentoPendente {
  itemId: string;
  etapa: "ganha" | "perdida";
  titulo: string;
  /** Valor da proposta ou, sem ela, o estimado pelo órgão */
  valorSugerido: number | null;
  /** Custo total do preço sugerido, quando há cotação */
  custoSugerido: number | null;
}

/** Folha curta que abre depois de mover um item para Ganha ou Perdida, para registrar o que a licitação rendeu. */
export function FolhaFechamento({ pendente, aoFechar }: { pendente: FechamentoPendente | null; aoFechar: () => void }) {
  const colunas = useColunas();
  return (
    <Sheet open={pendente !== null} onOpenChange={(aberto) => (aberto ? undefined : aoFechar())}>
      <SheetContent side={colunas ? "right" : "bottom"} className={colunas ? "gap-0 overflow-y-auto" : CLASSE_FOLHA}>
        {pendente ? (
          <>
            <SheetHeader className="pr-14">
              <SheetTitle>{pendente.etapa === "ganha" ? "Licitação ganha" : "Licitação perdida"}</SheetTitle>
              <SheetDescription className="line-clamp-2">{pendente.titulo}</SheetDescription>
            </SheetHeader>
            <div className="flex min-w-0 flex-col gap-3 px-4 pb-4">
              <FormularioFechamento
                key={pendente.itemId + pendente.etapa}
                itemId={pendente.itemId}
                etapa={pendente.etapa}
                valorInicial={pendente.valorSugerido}
                custoInicial={pendente.custoSugerido}
                motivoInicial={null}
                rotuloSaida="Pular"
                aoConcluir={() => aoFechar()}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
