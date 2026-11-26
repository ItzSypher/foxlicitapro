import { connection } from "next/server";
import { FolderArchive } from "lucide-react";
import { TIPOS_ACERVO, areasEmUso, ehTipoAcervo, filtrarAcervo, normalizarArea, type DocumentoAcervo, type TipoAcervo } from "@/core/acervo";
import { temPermissao } from "@/core/permissoes";
import { listarAcervo } from "@/db/acervo";
import { exigirSessao } from "@/lib/sessao";
import { plural } from "@/lib/formato";
import { BotaoAdicionarAcervo } from "@/components/acervo/acoes-acervo";
import { CartaoAcervo } from "@/components/acervo/cartao-acervo";
import { FiltrosAcervo } from "@/components/acervo/filtros-acervo";

export const metadata = { title: "Acervo · FoxLicita Pro" };

interface Props {
  searchParams: Promise<{ tipo?: string | string[]; area?: string | string[]; q?: string | string[] }>;
}

/** Instante do pedido, lido fora do render. */
function momento(): number {
  return Date.now();
}

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function AcervoPage({ searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const agora = momento();
  const params = await searchParams;
  const tipoPedido = primeiro(params.tipo);
  const tipo: TipoAcervo | null = ehTipoAcervo(tipoPedido) ? tipoPedido : null;
  const busca = primeiro(params.q).trim().slice(0, 100);
  const areaPedida = normalizarArea(primeiro(params.area));
  const podeEditar = temPermissao(sessao, "editar_propostas");

  let todos: DocumentoAcervo[] | null;
  try {
    todos = await listarAcervo(sessao.empresaId);
  } catch (e) {
    console.error("[acervo] leitura falhou:", e instanceof Error ? e.message : e);
    todos = null;
  }

  const areas = todos === null ? [] : areasEmUso(todos);
  const area = areaPedida !== "" && areas.includes(areaPedida) ? areaPedida : null;
  const lista = todos === null ? [] : filtrarAcervo(todos, { tipo, area, busca });
  const porTipo = Object.fromEntries(TIPOS_ACERVO.map((t) => [t, todos?.filter((d) => d.tipo === t).length ?? 0])) as Record<TipoAcervo, number>;
  const filtrando = tipo !== null || area !== null || busca !== "";

  return (
    <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Acervo</h1>
          <p className="text-sm text-muted-foreground">Atestados, notas, contratos e certidões da empresa.</p>
        </div>
        {podeEditar ? <BotaoAdicionarAcervo /> : null}
      </header>

      {todos === null ? (
        <p role="alert" className="rounded-xl border border-border px-4 py-5 text-sm text-negative">
          Não foi possível carregar o acervo agora. Tente de novo em instantes.
        </p>
      ) : todos.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <FolderArchive aria-hidden="true" className="size-8 text-faint" />
          <p className="text-base font-medium text-ink">Seu acervo está vazio</p>
          <p className="max-w-[40ch] text-sm text-muted-foreground">Guarde foto ou PDF. Quando uma licitação pedir comprovação, o sistema sugere o que serve.</p>
          {podeEditar ? <BotaoAdicionarAcervo rotulo="Adicionar o primeiro documento" /> : null}
        </section>
      ) : (
        <>
          <FiltrosAcervo tipo={tipo} area={area} busca={busca} areas={areas} porTipo={porTipo} total={todos.length} />
          {lista.length === 0 ? (
            <p className="rounded-xl border border-border px-4 py-5 text-sm text-muted-foreground">
              {filtrando ? "Nenhum documento encontrado com esses filtros." : "Nenhum documento."}
            </p>
          ) : (
            <section aria-label="Documentos do acervo" className="flex flex-col gap-2">
              <p className="text-[13px] text-muted-foreground">
                {lista.length} {plural(lista.length, "documento", "documentos")}
              </p>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {lista.map((d) => (
                  <CartaoAcervo key={d.id} documento={d} agora={agora} podeEditar={podeEditar} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
