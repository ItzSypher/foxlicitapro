import { LogOut } from "lucide-react";
import { sair } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  modo: "icone" | "completo";
  className?: string;
}

export function BotaoSair({ modo, className }: Props) {
  return (
    <form action={sair}>
      <Button
        type="submit"
        variant="ghost"
        aria-label="Sair"
        className={cn(
          modo === "icone" ? "size-11" : "h-10 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground",
          className,
        )}
      >
        <LogOut className="size-[18px]" aria-hidden="true" />
        {modo === "completo" ? <span>Sair</span> : null}
      </Button>
    </form>
  );
}
