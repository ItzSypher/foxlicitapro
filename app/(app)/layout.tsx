import { BotaoSair } from "@/components/botao-sair";
import { Marca } from "@/components/marca";
import { NavInferior, NavLateral } from "@/components/navegacao";
import { TemaToggle } from "@/components/tema-toggle";

export default function CascaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ground lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
        <div className="flex flex-col gap-1.5 px-3">
          <Marca className="size-8" />
          <p className="text-xs text-muted-foreground">70.048.886 Arthur Silva Moura · MEI</p>
        </div>

        <div className="mt-6">
          <NavLateral />
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <TemaToggle modo="completo" />
          <BotaoSair modo="completo" />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-[52px] items-center justify-between border-b border-border bg-ground pr-1 pl-4 lg:hidden">
        <Marca className="size-8" />
        <div className="flex items-center">
          <TemaToggle modo="icone" />
          <BotaoSair modo="icone" />
        </div>
      </header>

      <NavInferior />

      <main className="min-w-0 flex-1 px-4 pt-[calc(52px+1rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
