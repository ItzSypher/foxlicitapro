import type { CodigoCnae } from "@/core/empresa";
import { PERFIL_ORIGEM } from "@/core/empresa";
import { cnaesDaFrente as cnaesDoPerfil, ehMei, frenteDoCnae, type CnaePerfil, type PerfilEmpresa } from "@/core/perfil";
import { MARGENS_POR_CNAE } from "@/core/margens";
import { resumirObjeto } from "@/core/objeto";
import type { MargemSugerida } from "@/core/margens";
import {
  VENDAS_PREVISTAS_PADRAO,
  calcularPrecificacao,
} from "@/core/precificacao";
import type {
  CalculoPrecificacao,
  EntradaPrecificacao,
  ErroPrecificacao,
  Regime,
} from "@/core/precificacao";
import type { Frente } from "@/core/types";
import { fracaoParaCampoPercentual, formatarNumeroBR, parseNumeroBR } from "./numero";

/** Tudo que o usuário digita, como texto. */
export interface Formulario {
  descricao: string;
  frente: Frente;
  cnae: string;
  custo: string;
  frete: string;
  extras: string;
  teto: string;
  margemMinima: string;
  margemAlvo: string;
  regime: Regime;
  vendas: string;
}

export type CampoNumerico =
  | "custo"
  | "frete"
  | "extras"
  | "teto"
  | "margemMinima"
  | "margemAlvo"
  | "vendas";

/** Campo do formulário a que cada erro do cálculo se refere. */
const CAMPO_DO_ERRO: Record<string, CampoNumerico> = {
  custo: "custo",
  frete: "frete",
  extras: "extras",
  tetoOrgao: "teto",
  margemMinima: "margemMinima",
  margemAlvo: "margemAlvo",
  vendasPrevistasNoMes: "vendas",
};

const ROTULO_DO_CAMPO: Record<CampoNumerico, string> = {
  custo: "O custo",
  frete: "O frete",
  extras: "Os extras",
  teto: "O teto",
  margemMinima: "A margem mínima",
  margemAlvo: "A margem alvo",
  vendas: "As vendas previstas",
};

export type EstadoCalculo =
  | { tipo: "pendente" }
  | { tipo: "erro"; erros: Partial<Record<CampoNumerico, string>> }
  | { tipo: "ok"; calculo: CalculoPrecificacao; entrada: EntradaPrecificacao };

export function cnaesDaFrente(cnaes: readonly CnaePerfil[], frente: Frente): readonly { codigo: string; descricao: string }[] {
  return cnaesDoPerfil({ cnaes: [...cnaes] }, frente);
}

export function margemDoCnae(codigo: string): MargemSugerida | null {
  return codigo in MARGENS_POR_CNAE ? MARGENS_POR_CNAE[codigo as CodigoCnae] : null;
}

/** Margens sugeridas do CNAE, já como texto de campo; vazio se o CNAE não tem sugestão. */
export function margensComoTexto(codigo: string): Pick<Formulario, "margemMinima" | "margemAlvo"> {
  const margem = margemDoCnae(codigo);
  if (!margem) return { margemMinima: "", margemAlvo: "" };
  return {
    margemMinima: fracaoParaCampoPercentual(margem.minima),
    margemAlvo: fracaoParaCampoPercentual(margem.alvo),
  };
}

export interface ItemInicial {
  objeto: string;
  valorEstimado: number | null;
  frente: Frente | null;
  cnae: string | null;
}

export function formularioInicial(frentePadrao: Frente, item: ItemInicial | null, perfil: PerfilEmpresa = PERFIL_ORIGEM): Formulario {
  const base: Formulario = {
    descricao: "",
    frente: frentePadrao,
    cnae: "",
    custo: "",
    frete: "",
    extras: "",
    teto: "",
    margemMinima: "",
    margemAlvo: "",
    regime: ehMei(perfil) ? "mei" : "simples",
    vendas: String(VENDAS_PREVISTAS_PADRAO),
  };
  if (!item) return base;

  const frente = item.frente ?? (item.cnae ? frenteDoCnae(perfil, item.cnae) : undefined) ?? frentePadrao;
  const cnae = item.cnae !== null && frenteDoCnae(perfil, item.cnae) === frente ? item.cnae : "";
  return {
    ...base,
    descricao: resumirObjeto(item.objeto).slice(0, 120),
    frente,
    cnae,
    teto: item.valorEstimado !== null ? formatarNumeroBR(item.valorEstimado) : "",
    ...margensComoTexto(cnae),
  };
}

/** Formulário a partir de uma cotação salva. */
export function formularioDaEntrada(
  descricao: string,
  frente: Frente,
  cnae: string | null,
  entrada: EntradaPrecificacao,
): Formulario {
  return {
    descricao,
    frente,
    cnae: cnae ?? "",
    custo: formatarNumeroBR(entrada.custo),
    frete: entrada.frete > 0 ? formatarNumeroBR(entrada.frete) : "",
    extras: entrada.extras > 0 ? formatarNumeroBR(entrada.extras) : "",
    teto: entrada.tetoOrgao !== null ? formatarNumeroBR(entrada.tetoOrgao) : "",
    margemMinima: fracaoParaCampoPercentual(entrada.margemMinima),
    margemAlvo: fracaoParaCampoPercentual(entrada.margemAlvo),
    regime: entrada.regime,
    vendas: formatarNumeroBR(entrada.vendasPrevistasNoMes ?? VENDAS_PREVISTAS_PADRAO),
  };
}

function frase(erro: ErroPrecificacao, campo: CampoNumerico, frente: Frente): string {
  const rotulo = ROTULO_DO_CAMPO[campo];
  switch (erro.codigo) {
    case "valor-invalido":
      return `${rotulo} precisa ser um número, como 1.234,56.`;
    case "valor-negativo":
      return `${rotulo} não pode ser negativo.`;
    case "custo-total-zero":
      return "Informe um custo, frete ou extra maior que zero.";
    case "teto-invalido":
      return "O teto precisa ser maior que zero. Deixe em branco se não houver.";
    case "margem-invalida":
      return `${rotulo} precisa ficar entre 0% e 99%.`;
    case "margem-minima-maior-que-alvo":
      return "A margem mínima não pode passar da margem alvo.";
    case "aliquota-mais-margem-invalida":
      return `${rotulo} é alta demais: com o imposto do Simples (${frente === "produtos" ? "4%" : "6%"}), passaria de 100%.`;
    case "vendas-invalidas":
      return "Informe quantas vendas você espera no mês, acima de zero.";
  }
}

/** Lê o formulário e calcula. Campo obrigatório vazio é "pendente": sem erro, sem resultado. */
export function calcularFormulario(f: Formulario): EstadoCalculo {
  const custo = parseNumeroBR(f.custo);
  const frete = parseNumeroBR(f.frete);
  const extras = parseNumeroBR(f.extras);
  const teto = parseNumeroBR(f.teto);
  const margemMinima = parseNumeroBR(f.margemMinima);
  const margemAlvo = parseNumeroBR(f.margemAlvo);
  const vendas = parseNumeroBR(f.vendas);

  const obrigatorios: Array<number | null> = [custo, margemMinima, margemAlvo];
  if (f.regime === "mei") obrigatorios.push(vendas);
  const algumInvalido = [custo, frete, extras, teto, margemMinima, margemAlvo, vendas].some(
    (v) => v !== null && Number.isNaN(v),
  );
  if (!algumInvalido && obrigatorios.some((v) => v === null)) return { tipo: "pendente" };

  const entrada: EntradaPrecificacao = {
    custo: custo ?? 0,
    frete: frete ?? 0,
    extras: extras ?? 0,
    tetoOrgao: teto,
    margemMinima: margemMinima === null ? 0 : margemMinima / 100,
    margemAlvo: margemAlvo === null ? 0 : margemAlvo / 100,
    regime: f.regime,
    tipo: f.frente,
    ...(f.regime === "mei" ? { vendasPrevistasNoMes: vendas ?? VENDAS_PREVISTAS_PADRAO } : {}),
  };

  const resultado = calcularPrecificacao(entrada);
  if (resultado.ok) return { tipo: "ok", calculo: resultado.calculo, entrada };

  const erros: Partial<Record<CampoNumerico, string>> = {};
  for (const erro of resultado.erros) {
    const campo = CAMPO_DO_ERRO[erro.campo];
    if (campo && !(campo in erros)) erros[campo] = frase(erro, campo, f.frente);
  }
  return { tipo: "erro", erros };
}
