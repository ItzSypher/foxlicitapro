import "server-only";
import {
  SISTEMA_ATESTADO,
  numerosInventados,
  paragrafosDoTexto,
  pedidoRedacaoAtestado,
  textoPadraoAtestado,
  type EntradaTextoPadrao,
} from "@/core/atestados";
import { podeMontar } from "@/core/limite-diario";
import type { Sessao } from "@/core/types-equipe";
import { ErroAssistente, assistenteDisponivel, gerarTexto } from "@/lib/gemini";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { restantesHoje } from "./cota";

export interface EntradaRedacao {
  clienteNome: string;
  clienteCnpj: string | null;
  objeto: string;
  /** O que a empresa descreveu sobre os serviços (pode ser igual ao objeto) */
  descricao: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  valor: number | null;
}

export type ResultadoRedacao =
  | { ok: true; texto: string; origem: "assistente" | "modelo"; aviso: string | null }
  | { ok: false; erro: string };

const MAX_TOKENS = 1_500;

/** Tira marcação que o modelo às vezes devolve e normaliza os parágrafos. */
function limparSaida(bruto: string): string {
  const limpo = bruto.replace(/[*_`#]+/g, "").replace(/^\s*[-•]\s+/gm, "");
  return paragrafosDoTexto(limpo).join("\n\n");
}

/**
 * Redige o atestado a partir dos serviços descritos. Sem assistente, com limite do dia esgotado, com erro
 * ou com número que não estava nos dados, devolve o modelo padrão (com aviso quando faz sentido).
 */
export async function redigirAtestado(sessao: Sessao, entrada: EntradaRedacao): Promise<ResultadoRedacao> {
  let base: EntradaTextoPadrao;
  try {
    const empresa = await perfilDaEmpresa(sessao.empresaId);
    base = {
      emissoraRazaoSocial: empresa.razaoSocial,
      emissoraCnpj: empresa.cnpj,
      clienteNome: entrada.clienteNome,
      clienteCnpj: entrada.clienteCnpj,
      objeto: entrada.objeto,
      periodoInicio: entrada.periodoInicio,
      periodoFim: entrada.periodoFim,
      valor: entrada.valor,
    };
  } catch {
    return { ok: false, erro: "Não foi possível ler os dados da empresa agora. Tente de novo." };
  }
  const modelo = textoPadraoAtestado(base);
  if (!assistenteDisponivel()) return { ok: true, texto: modelo, origem: "modelo", aviso: null };

  try {
    const cota = await restantesHoje(sessao.usuarioId);
    if (!podeMontar(cota)) {
      return { ok: true, texto: modelo, origem: "modelo", aviso: "O limite diário do assistente acabou. Usei o modelo padrão." };
    }
  } catch {
    return { ok: true, texto: modelo, origem: "modelo", aviso: "O assistente não respondeu agora. Usei o modelo padrão." };
  }

  const pedido = pedidoRedacaoAtestado({ ...base, descricao: entrada.descricao });
  try {
    const gerado = limparSaida(
      await gerarTexto({ sistema: SISTEMA_ATESTADO, historico: [{ papel: "usuario", texto: pedido }], maxTokens: MAX_TOKENS }),
    );
    if (gerado.length < 40) {
      return { ok: true, texto: modelo, origem: "modelo", aviso: "O assistente não devolveu um texto utilizável. Usei o modelo padrão." };
    }
    if (numerosInventados(gerado, pedido).length > 0) {
      return {
        ok: true,
        texto: modelo,
        origem: "modelo",
        aviso: "O assistente incluiu números que você não informou. Usei o modelo padrão.",
      };
    }
    return { ok: true, texto: gerado, origem: "assistente", aviso: null };
  } catch (e) {
    if (!(e instanceof ErroAssistente)) console.error("[atestado] redação falhou:", e instanceof Error ? e.name : "erro");
    return { ok: true, texto: modelo, origem: "modelo", aviso: "O assistente não respondeu agora. Usei o modelo padrão." };
  }
}
