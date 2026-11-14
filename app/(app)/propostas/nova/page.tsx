import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { temPermissao } from "@/core/permissoes";
import { lerSessao } from "@/lib/sessao";
import { EscolhaModelo } from "@/components/propostas/escolha-modelo";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { lerChaveCompra } from "@/core/proposta";
import { ehModeloId, frentePredominante, sugerirModelo, type ModeloId } from "@/core/proposta-modelos";
import type { DetalheCompra } from "@/core/types-detalhe";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { criarRascunho } from "../rascunho";

export const metadata = { title: "Nova proposta · FoxLicita Pro" };

interface Props {
  searchParams: Promise<{ compra?: string | string[]; modelo?: string | string[] }>;
}

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

export default async function NovaPropostaPage({ searchParams }: Props) {
  await connection();
  const permitida = await lerSessao();
  if (!permitida || !temPermissao(permitida, "editar_propostas")) redirect("/propostas");
  const params = await searchParams;
  const compra = primeiro(params.compra);
  const modeloPedido = primeiro(params.modelo);
  const chave = compra === "" ? null : lerChaveCompra(compra);
  const compraValida = chave === null ? "" : compra;

  let falhou = false;
  if (ehModeloId(modeloPedido)) {
    const criado = await criarRascunho(permitida.empresaId, modeloPedido, compraValida === "" ? null : compraValida, permitida.usuarioId);
    if (criado) redirect(criado.semItens ? `/propostas/${criado.id}?aviso=itens` : `/propostas/${criado.id}`);
    falhou = true;
  }

  let detalhe: DetalheCompra | null = null;
  let semDetalhe = false;
  if (chave) {
    try {
      detalhe = await buscarDetalheCompra(chave);
    } catch {
      detalhe = null;
    }
    semDetalhe = detalhe === null;
  }

  let sugerido: ModeloId | null = null;
  if (detalhe) {
    const jar = await cookies();
    const frente = frentePredominante(detalhe, lerFrente(jar.get(COOKIE_FRENTE)?.value));
    sugerido = sugerirModelo(detalhe, frente);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/propostas" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-ink">
          Propostas
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Nova proposta</h1>
        <p className="text-sm text-muted-foreground">
          {detalhe ? `${detalhe.orgao}. ${detalhe.objeto}` : "Escolha o modelo para começar."}
        </p>
      </header>
      {falhou && (
        <p role="alert" className="text-[13px] text-negative">
          Não foi possível criar a proposta agora. Escolha o modelo de novo.
        </p>
      )}
      {semDetalhe && (
        <p role="status" className="rounded-card border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
          Não deu para puxar os itens do PNCP. Preencha à mão.
        </p>
      )}
      <EscolhaModelo compra={compraValida} sugerido={sugerido} />
    </div>
  );
}
