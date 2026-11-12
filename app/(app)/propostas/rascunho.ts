import "server-only";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import {
  dadosEmBranco,
  lerChaveCompra,
  montarDadosIniciais,
  numeroControleDe,
  tituloPadrao,
} from "@/core/proposta";
import { obterModelo, type ModeloId } from "@/core/proposta-modelos";
import type { DadosProposta, DetalheCompra } from "@/core/types-detalhe";
import { criarProposta } from "@/db/propostas";

/**
 * Cria o rascunho. Com compra, puxa os itens do detalhe; se o detalhe não vem,
 * a proposta nasce em branco, ainda ligada à compra, e `semItens` avisa a tela.
 * Devolve null quando o banco falha.
 */
export async function criarRascunho(
  modelo: ModeloId,
  compra: string | null,
): Promise<{ id: string; semItens: boolean } | null> {
  const hoje = new Date();
  const chave = compra === null ? null : lerChaveCompra(compra);
  let detalhe: DetalheCompra | null = null;
  if (chave) {
    try {
      detalhe = await buscarDetalheCompra(chave);
    } catch {
      detalhe = null;
    }
  }
  const dados: DadosProposta = detalhe ? montarDadosIniciais(detalhe, modelo, hoje) : dadosEmBranco(modelo, hoje);
  const compraId = detalhe?.numeroControle ?? (chave ? numeroControleDe(chave) : null);
  try {
    const id = await criarProposta({
      compraId,
      modelo,
      titulo: detalhe ? tituloPadrao(dados) : `Nova proposta · ${obterModelo(modelo).nome}`,
      dados,
      totalCentavos: 0,
    });
    return { id, semItens: chave !== null && detalhe === null };
  } catch {
    return null;
  }
}
