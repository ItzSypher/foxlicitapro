import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";
import { Marca } from "@/components/marca";
import { NavInferior, NavLateral, type DadosNav } from "@/components/navegacao";
import { TemaToggle } from "@/components/tema-toggle";
import { contarPropostasParaMim } from "@/db/propostas";
import { rotuloPapel } from "@/lib/papel";
import { lerSessao } from "@/lib/sessao";

/** Barra lateral, cabeçalho do celular e barra inferior. Sem dados, mostra a casca sem usuário. */
export function Casca({ dados }: { dados: DadosNav }) {
  const { usuario } = dados;
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
        <div className="flex flex-col gap-1.5 px-3">
          <Marca className="size-8" />
          <p className="text-xs text-muted-foreground">70.048.886 Arthur Silva Moura · MEI</p>
        </div>

        <div className="mt-6">
          <NavLateral dados={dados} />
        </div>

        <div className="mt-auto flex flex-col gap-1">
          {usuario ? (
            <Link
              href="/equipe/conta"
              className="flex min-h-11 flex-col justify-center rounded-control px-3 outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="truncate text-sm font-medium text-ink">{usuario.nome}</span>
              <span className="text-xs text-muted-foreground">{rotuloPapel(usuario.papel)} · Minha conta</span>
            </Link>
          ) : null}
          <TemaToggle modo="completo" />
          <BotaoSair modo="completo" />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-[52px] items-center justify-between border-b border-border bg-ground pr-1 pl-4 lg:hidden">
        <Marca className="size-8" />
        <TemaToggle modo="icone" />
      </header>

      <NavInferior dados={dados} />
    </>
  );
}

/** Lê a sessão e a contagem de propostas pendentes; se o banco falhar, a casca aparece sem o selo. */
export async function CascaComDados() {
  const sessao = await lerSessao();
  let pendentes = 0;
  if (sessao) {
    try {
      pendentes = await contarPropostasParaMim(sessao.usuarioId);
    } catch (e) {
      console.error("[casca] contagem de propostas falhou:", e instanceof Error ? e.message : e);
    }
  }
  return (
    <Casca dados={{ usuario: sessao ? { nome: sessao.nome, papel: sessao.papel } : null, pendentes }} />
  );
}
