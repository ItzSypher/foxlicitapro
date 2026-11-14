import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FormularioFornecedor } from "@/components/fornecedores/formulario";
import { NovoPreco } from "@/components/fornecedores/novo-preco";
import { agruparPrecosPorItem, type DadosFornecedor, type PrecoFornecedor } from "@/core/fornecedores";
import { temPermissao } from "@/core/permissoes";
import { lerFornecedor, listarPrecos } from "@/db/fornecedores";
import { formatarMoeda, plural } from "@/lib/formato";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Fornecedor · FoxLicita Pro" };

interface Props {
  params: Promise<{ id: string }>;
}

/** AAAA-MM-DD para DD/MM/AAAA. */
function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export default async function FornecedorPage({ params }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const { id } = await params;
  const fornecedor = await lerFornecedor(sessao.empresaId, id);
  if (!fornecedor) notFound();
  const podeEditar = temPermissao(sessao, "editar_propostas");

  let precos: PrecoFornecedor[] = [];
  try {
    precos = await listarPrecos(sessao.empresaId, fornecedor.id);
  } catch (e) {
    console.error("[fornecedores] histórico indisponível:", e instanceof Error ? e.message : e);
  }
  const itens = agruparPrecosPorItem(precos);
  const dados: DadosFornecedor = {
    nome: fornecedor.nome,
    cnpj: fornecedor.cnpj,
    contato: fornecedor.contato,
    telefone: fornecedor.telefone,
    email: fornecedor.email,
    site: fornecedor.site,
    categorias: fornecedor.categorias,
    observacao: fornecedor.observacao,
    ativo: fornecedor.ativo,
  };

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-x-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <Link href="/fornecedores" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
            Fornecedores
          </Link>
          <h1 className="text-[22px] font-semibold leading-tight text-ink">{fornecedor.nome}</h1>
        </header>
        <FormularioFornecedor key={`${fornecedor.id}-${JSON.stringify(dados)}`} id={fornecedor.id} inicial={dados} podeEditar={podeEditar} />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {podeEditar ? <NovoPreco fornecedorId={fornecedor.id} /> : null}

        <section aria-labelledby="titulo-medias" className="flex flex-col gap-2">
          <h2 id="titulo-medias" className="text-base font-semibold text-ink">
            Média por item
          </h2>
          {itens.length === 0 ? (
            <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">Nenhum preço registrado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
              {itens.map((i) => (
                <li key={i.chave} className="flex flex-col gap-1 px-3 py-2.5">
                  <p className="text-sm text-ink">
                    {i.descricao}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {i.quantidade} {plural(i.quantidade, "preço", "preços")} · {i.unidade}
                    </span>
                  </p>
                  <p className="text-[13px] text-muted-foreground tabular-nums">
                    Média <span className="text-ink">{formatarMoeda(i.media)}</span> · menor{" "}
                    <span className="text-ink">{formatarMoeda(i.menor)}</span> · maior{" "}
                    <span className="text-ink">{formatarMoeda(i.maior)}</span> · último{" "}
                    <span className="text-ink">{formatarMoeda(i.ultimo)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {precos.length > 0 ? (
          <section aria-labelledby="titulo-historico" className="flex flex-col gap-2">
            <h2 id="titulo-historico" className="text-base font-semibold text-ink">
              Histórico de preços
            </h2>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
              {precos.map((p) => (
                <li key={p.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5">
                  <span className="truncate text-sm text-ink">{p.descricao}</span>
                  <span className="text-right text-[13px] tabular-nums text-ink">{formatarMoeda(p.preco)}</span>
                  <span className="text-xs text-faint">
                    {dataBr(p.data)} · {p.origem === "cotacao" ? "Da calculadora" : "Manual"}
                    {p.prazoDias === null ? "" : ` · prazo ${p.prazoDias} ${plural(p.prazoDias, "dia", "dias")}`}
                  </span>
                  <span className="text-right text-xs text-faint">{p.unidade}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
