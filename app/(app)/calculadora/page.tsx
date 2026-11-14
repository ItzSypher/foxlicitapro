import { cookies } from "next/headers";
import { connection } from "next/server";
import { CalculadoraView } from "@/components/calculadora/calculadora-view";
import { formularioInicial } from "@/components/calculadora/estado";
import { temPermissao } from "@/core/permissoes";
import { listarCotacoes, lerItemParaCotacao } from "@/db/cotacoes";
import { listarFornecedores } from "@/db/fornecedores";
import type { CotacaoSalva, ItemParaCotacao } from "@/db/cotacoes";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Calculadora · FoxLicita Pro" };

interface Props {
  searchParams: Promise<{ item?: string | string[] }>;
}

export default async function CalculadoraPage({ searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const perfil = await perfilAtual();
  const { item } = await searchParams;
  const itemId = (Array.isArray(item) ? item[0] : item)?.trim() || null;
  const jar = await cookies();
  const frentePadrao = lerFrente(jar.get(COOKIE_FRENTE)?.value);

  let oportunidade: ItemParaCotacao | null = null;
  if (itemId !== null) {
    try {
      oportunidade = await lerItemParaCotacao(sessao.empresaId, itemId);
    } catch {
      oportunidade = null;
    }
  }

  let cotacoes: CotacaoSalva[] = [];
  try {
    cotacoes = await listarCotacoes(sessao.empresaId, oportunidade?.id ?? null, 10);
  } catch {
    cotacoes = [];
  }

  let fornecedores: { id: string; nome: string }[] = [];
  if (temPermissao(sessao, "editar_propostas")) {
    try {
      fornecedores = (await listarFornecedores(sessao.empresaId)).filter((f) => f.ativo).map((f) => ({ id: f.id, nome: f.nome }));
    } catch {
      fornecedores = [];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Calculadora</h1>
        <p className="text-sm text-muted-foreground">Quanto cobrar sem tomar prejuízo.</p>
      </header>
      <CalculadoraView
        key={oportunidade?.id ?? "livre"}
        itemId={oportunidade?.id ?? null}
        objeto={oportunidade?.objeto ?? null}
        inicial={formularioInicial(frentePadrao, oportunidade, perfil)}
        cotacoes={cotacoes}
        cnaes={perfil.cnaes}
        fornecedores={fornecedores}
      />
    </div>
  );
}
