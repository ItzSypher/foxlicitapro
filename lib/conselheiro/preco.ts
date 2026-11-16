import type { ItemPipeline } from "@/components/pipeline/tipos";
import type { AmostraConcorrente } from "@/core/concorrentes";
import type { PrecoFornecedor } from "@/core/fornecedores";
import { resumirObjeto } from "@/core/objeto";
import type { Porte } from "@/core/perfil";
import { precoSugeridoDoItem, type PrecoSugerido } from "@/core/preco-sugerido";

/** Preço sugerido de um item do Pipeline, montado como na página do Pipeline (core/preco-sugerido.ts). */
export function precoDoItemPipeline(
  i: ItemPipeline,
  porte: Porte,
  amostras: readonly AmostraConcorrente[],
  precosFornecedor: readonly PrecoFornecedor[],
): PrecoSugerido {
  return precoSugeridoDoItem(
    {
      id: i.item.id,
      objeto: i.item.objeto,
      uf: i.item.uf,
      valorEstimado: i.item.valorEstimado,
      frente: i.item.score.frenteCasada,
      cnaes: i.item.score.cnaesCasados,
    },
    porte,
    i.cotacoes,
    amostras,
    precosFornecedor,
    resumirObjeto(i.item.objeto),
  );
}
