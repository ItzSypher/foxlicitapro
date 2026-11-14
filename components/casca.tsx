import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";
import { Marca } from "@/components/marca";
import { NavInferior, NavLateral, type DadosNav } from "@/components/navegacao";
import { TemaToggle } from "@/components/tema-toggle";
import { contarPropostasParaMim } from "@/db/propostas";
import { rotuloPapel } from "@/lib/papel";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { lerSessao } from "@/lib/sessao";
import { formatarCnpj } from "@/core/brasilapi";
import { nomeExibicao } from "@/core/perfil";
import { ROTULO_PORTE } from "@/core/perfil";

/** Barra lateral, cabeçalho do celular e barra inferior. Sem dados, mostra a casca sem usuário. */
export function Casca({ dados, empresa }: { dados: DadosNav; empresa?: string }) {
  const { usuario } = dados;
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
        <div className="flex flex-col gap-1.5 px-3">
          <Marca className="size-8" />
          {empresa ? <p className="text-xs leading-snug text-muted-foreground">{empresa}</p> : null}
        </div>

        <div className="mt-6 overflow-y-auto">
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

      <header className="fixed inset-x-0 top-0 z-30 flex h-[52px] items-center gap-2 border-b border-border bg-ground pr-1 pl-4 lg:hidden">
        <Marca className="size-8 shrink-0" />
        {usuario ? (
          <Link
            href="/equipe/conta"
            aria-label={`Minha conta: ${usuario.nome}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-center rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {empresa ? <span className="truncate text-[13px] leading-tight font-medium text-ink">{empresa}</span> : null}
            <span className="truncate text-xs leading-tight text-muted-foreground">
              {usuario.nome} · {rotuloPapel(usuario.papel)}
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {empresa ? <p className="truncate text-[13px] leading-tight font-medium text-ink">{empresa}</p> : null}
          </div>
        )}
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
  let empresa: string | undefined;
  if (sessao) {
    try {
      const perfil = await perfilDaEmpresa(sessao.empresaId);
      empresa = `${formatarCnpj(perfil.cnpj).slice(0, 10)} ${nomeExibicao(perfil)} · ${ROTULO_PORTE[perfil.porte]}`;
    } catch (e) {
      console.error("[casca] perfil da empresa falhou:", e instanceof Error ? e.message : e);
    }
    try {
      pendentes = await contarPropostasParaMim(sessao.empresaId, sessao.usuarioId);
    } catch (e) {
      console.error("[casca] contagem de propostas falhou:", e instanceof Error ? e.message : e);
    }
  }
  return (
    <Casca
      dados={{ usuario: sessao ? { nome: sessao.nome, papel: sessao.papel, superadmin: sessao.superadmin } : null, pendentes }}
      empresa={empresa}
    />
  );
}
