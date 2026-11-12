import { Suspense } from "react";
import { AssistenteSeAtivo } from "@/components/assistente/assistente-servidor";
import { Casca, CascaComDados } from "@/components/casca";

export default function CascaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ground lg:flex">
      <Suspense fallback={<Casca dados={{ usuario: null, pendentes: 0 }} />}>
        <CascaComDados />
      </Suspense>

      <main className="min-w-0 flex-1 px-4 pt-[calc(52px+1rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>

      <Suspense fallback={null}>
        <AssistenteSeAtivo />
      </Suspense>
    </div>
  );
}
