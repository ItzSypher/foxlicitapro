import { describe, expect, it } from "vitest";
import {
  avaliarCaixa,
  caminhoDoDinheiro,
  nivelCaixa,
  tipoDoObjeto,
  valorEstimadoCaixa,
  type OportunidadeCaixa,
} from "./caminho-dinheiro";
import type { FichaEdital } from "./ficha";
import { FICHA_EXEMPLO } from "./ficha.fixture";

const SITE: OportunidadeCaixa = { objeto: "Criação e hospedagem de site institucional", valorEstimado: 12_000 };
const PRODUTO_PEQUENO: OportunidadeCaixa = { objeto: "Aquisição de canetas e papel", valorEstimado: 3_000 };
const PRODUTO_GRANDE: OportunidadeCaixa = { objeto: "Aquisição de cadeiras de escritório", valorEstimado: 40_000 };
const SERVICO: OportunidadeCaixa = { objeto: "Prestação de serviço de manutenção de ar condicionado", valorEstimado: 20_000 };

function ficha(parcial: Partial<FichaEdital>): FichaEdital {
  return { ...FICHA_EXEMPLO, ...parcial };
}

const SEM_EXTRAS = ficha({
  medicaoMensal: { valor: false, trecho: null, pagina: null },
  garantiaContratualPercentual: { valor: null, trecho: null, pagina: null },
});

describe("nivelCaixa sem ficha", () => {
  it("serviço feito à distância é baixo", () => {
    expect(nivelCaixa(SITE)).toBe("baixo");
    expect(tipoDoObjeto(SITE)).toBe("servico-remoto");
    expect(tipoDoObjeto({ objeto: "Licença do software ABBYY para acessibilização", valorEstimado: 1680 })).toBe("produto");
    expect(tipoDoObjeto({ objeto: "Subscrição de software de gestão jurídica", valorEstimado: 9000 })).toBe("produto");
    expect(
      tipoDoObjeto({ objeto: "Aquisição de 02 discos rígidos (HD) para o sistema de CFTV", valorEstimado: 4000, score: { frenteCasada: "servicos" } }),
    ).toBe("produto");
    expect(tipoDoObjeto({ objeto: "Aquisição de prestação de serviços de manutenção predial", valorEstimado: 4000 })).toBe("servico-presencial");
  });

  it("serviço presencial é baixo, e médio quando o valor é grande", () => {
    expect(nivelCaixa(SERVICO)).toBe("baixo");
    expect(nivelCaixa({ ...SERVICO, valorEstimado: 80_000 })).toBe("medio");
  });

  it("produto é médio até R$ 5 mil e alto acima", () => {
    expect(nivelCaixa(PRODUTO_PEQUENO)).toBe("medio");
    expect(nivelCaixa({ ...PRODUTO_PEQUENO, valorEstimado: 5_000 })).toBe("medio");
    expect(nivelCaixa(PRODUTO_GRANDE)).toBe("alto");
  });

  it("usa a frente do score quando existe", () => {
    const comoServico: OportunidadeCaixa = { objeto: "Pintura predial", valorEstimado: 10_000, score: { frenteCasada: "servicos" } };
    const comoProduto: OportunidadeCaixa = { objeto: "Pintura predial", valorEstimado: 10_000, score: { frenteCasada: "produtos" } };
    expect(nivelCaixa(comoServico)).toBe("baixo");
    expect(nivelCaixa(comoProduto)).toBe("alto");
  });

  it("valor sigiloso: produto médio, serviço baixo", () => {
    expect(nivelCaixa({ ...PRODUTO_GRANDE, valorEstimado: null })).toBe("medio");
    expect(nivelCaixa({ ...SERVICO, valorEstimado: null })).toBe("baixo");
  });
});

describe("nivelCaixa com ficha", () => {
  it("pagamento antecipado é baixo mesmo sendo produto", () => {
    const f = ficha({
      pagamentoAntecipado: { valor: true, condicao: "50% na ordem", trecho: null, pagina: null },
      garantiaContratualPercentual: { valor: null, trecho: null, pagina: null },
    });
    expect(nivelCaixa(PRODUTO_GRANDE, f)).toBe("baixo");
  });

  it("garantia de 5% ou mais sobe um nível", () => {
    const g5 = ficha({ garantiaContratualPercentual: { valor: 5, trecho: null, pagina: null } });
    const g4 = ficha({ garantiaContratualPercentual: { valor: 4, trecho: null, pagina: null } });
    expect(nivelCaixa(SITE, g5)).toBe("medio");
    expect(nivelCaixa(SITE, g4)).toBe("baixo");
    expect(nivelCaixa(PRODUTO_PEQUENO, g5)).toBe("alto");
    expect(nivelCaixa(PRODUTO_GRANDE, g5)).toBe("alto");
    expect(avaliarCaixa(SITE, g5).explicacao).toContain("5%");
  });

  it("traz uma explicação curta para cada nível", () => {
    expect(avaliarCaixa(SITE).explicacao).toContain("sem comprar mercadoria");
    expect(avaliarCaixa(PRODUTO_PEQUENO).explicacao).toContain("valor");
    expect(avaliarCaixa(PRODUTO_GRANDE).explicacao).toContain("paga o fornecedor");
  });
});

describe("caminhoDoDinheiro", () => {
  it("com ficha: etapas na ordem, dias sem receber e prazos exatos", () => {
    const c = caminhoDoDinheiro(SEM_EXTRAS, PRODUTO_GRANDE);
    expect(c.comFicha).toBe(true);
    expect(c.etapas.map((e) => e.id)).toEqual(["empenho", "ordem", "entrega", "atesto", "pagamento"]);
    expect(c.etapas[1].rotulo).toBe("Ordem de fornecimento");
    expect(c.etapas[2].prazo).toBe("em até 10 dias");
    expect(c.etapas[4].prazo).toBe("em até 30 dias");
    expect(c.diasSemReceber).toBe(40);
  });

  it("serviço usa ordem de serviço e execução", () => {
    const c = caminhoDoDinheiro(SEM_EXTRAS, SERVICO);
    expect(c.etapas[1].rotulo).toBe("Ordem de serviço");
    expect(c.etapas[2].rotulo).toBe("Execução do serviço");
  });

  it("medição mensal entra antes do atesto", () => {
    const c = caminhoDoDinheiro(ficha({}), SERVICO);
    expect(c.etapas.map((e) => e.id)).toEqual(["empenho", "ordem", "entrega", "medicao", "atesto", "pagamento"]);
  });

  it("pagamento antecipado entra antes da entrega e zera os dias sem receber", () => {
    const f = ficha({ pagamentoAntecipado: { valor: true, condicao: "30% na ordem de fornecimento", trecho: null, pagina: null } });
    const c = caminhoDoDinheiro(f, PRODUTO_GRANDE);
    expect(c.etapas.map((e) => e.id).slice(0, 4)).toEqual(["empenho", "ordem", "antecipado", "entrega"]);
    expect(c.etapas[2].detalhe).toBe("30% na ordem de fornecimento");
    expect(c.diasSemReceber).toBe(0);
  });

  it("dias sem receber é null quando falta um prazo", () => {
    const f = ficha({ prazoPagamentoDias: { valor: null, trecho: null, pagina: null } });
    const c = caminhoDoDinheiro(f, PRODUTO_GRANDE);
    expect(c.diasSemReceber).toBeNull();
    expect(c.etapas[c.etapas.length - 1].prazo).toBe("prazo não informado");
  });

  it("sem ficha: etapas padrão, sem dias exatos", () => {
    const c = caminhoDoDinheiro(null, PRODUTO_GRANDE);
    expect(c.comFicha).toBe(false);
    expect(c.diasSemReceber).toBeNull();
    expect(c.etapas.map((e) => e.id)).toEqual(["empenho", "ordem", "entrega", "atesto", "pagamento"]);
  });

  it("valorEstimadoCaixa devolve o mesmo valor do caminho, com ou sem ficha", () => {
    expect(valorEstimadoCaixa(PRODUTO_GRANDE)).toBeCloseTo(32_000);
    expect(valorEstimadoCaixa(SERVICO, null)).toBeCloseTo(2_000);
    expect(valorEstimadoCaixa(SITE)).toBe(0);
    expect(valorEstimadoCaixa({ ...PRODUTO_GRANDE, valorEstimado: null })).toBeNull();
  });

  it("caixa necessário: produto ~80% do valor, serviço ~10%, site zero", () => {
    expect(caminhoDoDinheiro(null, PRODUTO_GRANDE).caixaNecessario.valor).toBeCloseTo(32_000);
    expect(caminhoDoDinheiro(null, SERVICO).caixaNecessario.valor).toBeCloseTo(2_000);
    expect(caminhoDoDinheiro(null, SITE).caixaNecessario.valor).toBe(0);
    expect(caminhoDoDinheiro(null, { ...PRODUTO_GRANDE, valorEstimado: null }).caixaNecessario.valor).toBeNull();
  });

  it("garantia contratual soma ao caixa, e medição mensal usa a parcela do mês", () => {
    const g5 = ficha({
      medicaoMensal: { valor: false, trecho: null, pagina: null },
      garantiaContratualPercentual: { valor: 5, trecho: null, pagina: null },
    });
    expect(caminhoDoDinheiro(g5, SITE).caixaNecessario.valor).toBeCloseTo(600);
    expect(caminhoDoDinheiro(g5, PRODUTO_GRANDE).caixaNecessario.valor).toBeCloseTo(34_000);
    const mensal = ficha({ garantiaContratualPercentual: { valor: null, trecho: null, pagina: null } });
    expect(caminhoDoDinheiro(mensal, { ...SERVICO, valorEstimado: 12_000 }).caixaNecessario.valor).toBeCloseTo(100);
  });

  it("antecipado: só a garantia sai do bolso", () => {
    const f = ficha({
      pagamentoAntecipado: { valor: true, condicao: null, trecho: null, pagina: null },
      garantiaContratualPercentual: { valor: 5, trecho: null, pagina: null },
    });
    expect(caminhoDoDinheiro(f, PRODUTO_GRANDE).caixaNecessario.valor).toBeCloseTo(2_000);
  });

  it("dicas incluem empenho antes de comprar, nota no dia e liquidação", () => {
    const texto = caminhoDoDinheiro(null, PRODUTO_GRANDE).dicas.join(" ");
    expect(texto).toContain("nota de empenho");
    expect(texto).toContain("nota fiscal no dia da entrega");
    expect(texto).toContain("liquidação");
  });
});
