import "server-only";
import { cacheLife } from "next/cache";
import { buscarComplementoCompra, buscarDetalheGeral } from "@/core/pncp/detalhe";
import type { ComplementoCompra, DetalheCompra } from "@/core/types-detalhe";

/*
 * Cache de dados (`use cache`) das chamadas ao PNCP da tela de licitação.
 * O edital muda pouco: vale alguns minutos, e abrir a mesma licitação de novo (ou outra pessoa da empresa,
 * ou o Pipeline abrindo vários cards) não refaz as chamadas. Só argumentos simples entram na chave.
 * Erro não entra no cache (a função lança); resultado ruim (não achou, itens ou arquivos com falha) vale poucos segundos.
 */

export async function detalheGeralEmCache(cnpj: string, ano: number, sequencial: number): Promise<DetalheCompra | null> {
  "use cache";
  const detalhe = await buscarDetalheGeral({ cnpj, ano, sequencial });
  if (detalhe === null) cacheLife("seconds");
  else cacheLife({ stale: 60, revalidate: 300, expire: 1800 });
  return detalhe;
}

export async function complementoEmCache(cnpj: string, ano: number, sequencial: number): Promise<ComplementoCompra> {
  "use cache";
  const complemento = await buscarComplementoCompra({ cnpj, ano, sequencial });
  if (complemento.falhas.length > 0) cacheLife("seconds");
  else cacheLife({ stale: 60, revalidate: 300, expire: 1800 });
  return complemento;
}
