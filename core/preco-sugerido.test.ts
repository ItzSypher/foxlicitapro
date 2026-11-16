import { describe, expect, it } from "vitest";
import type { AmostraConcorrente, EstatisticasConcorrentes } from "./concorrentes";
import { resumirCotacoes, type CotacaoParaResumo, type ResumoCotacoes } from "./cotacoes-resumo";
import type { PrecoFornecedor } from "./fornecedores";
import {
  calcularPrecoSugerido,
  precoSugeridoDoItem,
  vereditoDoPreco,
  type EntradaPrecoSugerido,
} from "./preco-sugerido";

/** Margem alvo do CNAE de informática: 18%. Simples de produtos: 4%. */
const CNAE_INFORMATICA = "47.51-2-01";
/** Margem alvo do CNAE de serviço de manutenção: 50%. Simples de serviços: 6%. */
const CNAE_SERVICO = "95.11-8-00";

function cotacao(parcial: Partial<CotacaoParaResumo> = {}): CotacaoParaResumo {
  return {
    descricao: "Monitor 24 polegadas",
    frente: "produtos",
    precoVenda: 1300,
    custo: 1000,
    margem: 0.2,
    criadoEm: "2026-11-01T10:00:00.000Z",
    ...parcial,
  };
}

function resumo(cotacoes: CotacaoParaResumo[] = [cotacao()]): ResumoCotacoes {
  const r = resumirCotacoes(cotacoes);
  if (r === null) throw new Error("fixture sem cotação");
  return r;
}

function concorrentes(parcial: Partial<EstatisticasConcorrentes> = {}): EstatisticasConcorrentes {
  return { amostras: 5, media: 1000, minimo: 800, maximo: 1200, descontoMedioPct: 20, amostrasComDesconto: 5, ...parcial };
}

function entrada(parcial: Partial<EntradaPrecoSugerido> = {}): EntradaPrecoSugerido {
  return {
    valorEstimado: 1500,
    frente: "produtos",
    cnaes: [CNAE_INFORMATICA],
    porte: "me",
    cotacoes: resumo(),
    concorrentes: null,
    precoFornecedor: null,
    ...parcial,
  };
}

const centavos = (v: number): number => Math.round(v * 100) / 100;

describe("vereditoDoPreco", () => {
  it("alvo até o teto vale, inclusive no limite", () => {
    expect(vereditoDoPreco(1000, 1200, 1200)).toBe("vale");
    expect(vereditoDoPreco(1000, 1200, 1500)).toBe("vale");
  });

  it("piso até o teto e alvo acima do teto é apertado, inclusive com teto igual ao piso", () => {
    expect(vereditoDoPreco(1000, 1200, 1199.99)).toBe("apertado");
    expect(vereditoDoPreco(1000, 1200, 1000)).toBe("apertado");
  });

  it("piso acima do teto não vale", () => {
    expect(vereditoDoPreco(1000, 1200, 999.99)).toBe("nao-vale");
  });

  it("sem teto não há limite a respeitar", () => {
    expect(vereditoDoPreco(1000, 1200, null)).toBe("vale");
  });
});

describe("calcularPrecoSugerido: piso, alvo e lucro (Simples, produtos)", () => {
  it("piso é custo mais imposto, alvo inclui a margem do CNAE", () => {
    const r = calcularPrecoSugerido(entrada());
    expect(r.regime).toBe("simples");
    expect(r.piso).toBe(centavos(1000 / 0.96));
    expect(r.alvo).toBe(centavos(1000 / 0.78));
    expect(r.margemAlvoPct).toBe(18);
    expect(r.lucroNoAlvo).toBe(centavos(1000 / 0.78 - 1000 - (1000 / 0.78) * 0.04));
    expect(r.custoTotal).toBe(1000);
  });

  it("soma frete e extras ao custo e soma os itens cotados com descrições diferentes", () => {
    const r = calcularPrecoSugerido(
      entrada({
        cotacoes: resumo([
          cotacao({ descricao: "Monitor", custo: 700, custoTotal: 800 }),
          cotacao({ descricao: "Teclado", custo: 150, custoTotal: 200 }),
        ]),
      }),
    );
    expect(r.custoTotal).toBe(1000);
    expect(r.fontes[0]).toContain("2 itens cotados");
  });

  it("usa a média quando o mesmo item tem várias cotações", () => {
    const r = calcularPrecoSugerido(
      entrada({
        cotacoes: resumo([
          cotacao({ custo: 900, criadoEm: "2026-11-01T10:00:00.000Z" }),
          cotacao({ custo: 1100, criadoEm: "2026-11-02T10:00:00.000Z" }),
        ]),
      }),
    );
    expect(r.custoTotal).toBe(1000);
    expect(r.fontes[0]).toContain("1 item cotado");
    expect(r.fontes[0]).toContain("2 cotações");
  });

  it("serviço usa a alíquota de 6% e a margem do CNAE de serviço", () => {
    const r = calcularPrecoSugerido(
      entrada({
        frente: "servicos",
        cnaes: [CNAE_SERVICO],
        cotacoes: resumo([cotacao({ frente: "servicos" })]),
        valorEstimado: 5000,
      }),
    );
    expect(r.piso).toBe(centavos(1000 / 0.94));
    expect(r.alvo).toBe(centavos(1000 / 0.44));
    expect(r.margemAlvoPct).toBe(50);
    expect(r.fontes.join(" ")).toContain("Anexo III");
  });

  it("sem frente no item, a frente das cotações define o imposto", () => {
    const r = calcularPrecoSugerido(
      entrada({ frente: null, cotacoes: resumo([cotacao({ frente: "servicos" })]), cnaes: [CNAE_SERVICO], valorEstimado: 5000 }),
    );
    expect(r.piso).toBe(centavos(1000 / 0.94));
  });
});

describe("calcularPrecoSugerido: MEI contra Simples", () => {
  it("MEI não tem imposto sobre a venda, só o rateio do DAS no custo", () => {
    const mei = calcularPrecoSugerido(entrada({ porte: "mei" }));
    const dasPorVenda = (0.05 * 1621 + 1) / 4;
    expect(mei.regime).toBe("mei");
    expect(mei.piso).toBe(centavos(1000 + dasPorVenda));
    expect(mei.alvo).toBe(centavos((1000 + dasPorVenda) / 0.82));
    expect(mei.custoTotal).toBe(centavos(1000 + dasPorVenda));
    expect(mei.fontes.join(" ")).toContain("MEI");
  });

  it("o regime muda o piso e o texto das fontes", () => {
    const simples = calcularPrecoSugerido(entrada({ porte: "me" }));
    const mei = calcularPrecoSugerido(entrada({ porte: "mei" }));
    expect(simples.regime).toBe("simples");
    expect(mei.piso).not.toBe(simples.piso);
    expect(simples.fontes.join(" ")).toContain("Simples Nacional");
    expect(mei.fontes.join(" ")).not.toContain("Simples Nacional");
  });

  it("EPP e demais seguem o Simples", () => {
    expect(calcularPrecoSugerido(entrada({ porte: "epp" })).regime).toBe("simples");
    expect(calcularPrecoSugerido(entrada({ porte: "demais" })).regime).toBe("simples");
  });
});

describe("calcularPrecoSugerido: veredito e preço sugerido", () => {
  it("vale: estimado acima do alvo sugere o alvo", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: 1500 }));
    expect(r.veredito).toBe("vale");
    expect(r.teto).toBe(1500);
    expect(r.sugerido).toBe(r.alvo);
    expect(r.margemSugeridaPct).toBe(18);
  });

  it("apertado: estimado entre piso e alvo sugere o teto, com margem menor que a alvo", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: 1200 }));
    expect(r.veredito).toBe("apertado");
    expect(r.sugerido).toBe(1200);
    expect(r.margemSugeridaPct).toBe(Math.round(((1200 - 1000 - 48) / 1200) * 1000) / 10);
    expect(r.margemSugeridaPct).toBeLessThan(18);
  });

  it("não vale: estimado abaixo do piso sugere o piso, com margem zero", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: 1000 }));
    expect(r.veredito).toBe("nao-vale");
    expect(r.sugerido).toBe(r.piso);
    expect(r.margemSugeridaPct).toBe(0);
  });

  it("sem valor estimado e sem concorrentes: vale, sem teto e com confiança baixa", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: null }));
    expect(r.veredito).toBe("vale");
    expect(r.teto).toBeNull();
    expect(r.confianca).toBe("baixa");
    expect(r.faltando.join(" ")).toContain("não informa valor estimado");
  });
});

describe("calcularPrecoSugerido: sem custo", () => {
  it("sem cotação o veredito é sem-custo e pede um fornecedor", () => {
    const r = calcularPrecoSugerido(entrada({ cotacoes: null }));
    expect(r.veredito).toBe("sem-custo");
    expect(r.piso).toBeNull();
    expect(r.alvo).toBeNull();
    expect(r.sugerido).toBeNull();
    expect(r.lucroNoAlvo).toBeNull();
    expect(r.custoTotal).toBeNull();
    expect(r.teto).toBe(1500);
    expect(r.confianca).toBe("baixa");
    expect(r.margemAlvoPct).toBe(18);
    expect(r.faltando).toContain("Cote ao menos 1 fornecedor");
  });

  it("cotação com custo zero também é sem-custo", () => {
    const r = calcularPrecoSugerido(entrada({ cotacoes: resumo([cotacao({ custo: 0 })]) }));
    expect(r.veredito).toBe("sem-custo");
    expect(r.faltando.join(" ")).toContain("custo zero");
  });

  it("preço de fornecedor parecido só orienta e não entra no custo", () => {
    const r = calcularPrecoSugerido(
      entrada({
        cotacoes: null,
        precoFornecedor: {
          total: 1,
          ultimo: precoFornecedor(),
          menor: precoFornecedor(),
        },
      }),
    );
    expect(r.veredito).toBe("sem-custo");
    expect(r.piso).toBeNull();
    expect(r.faltando.join(" ")).toContain("Fornecedor Alfa");
  });
});

function precoFornecedor(): PrecoFornecedor {
  return {
    id: "p1",
    fornecedorId: "f1",
    fornecedorNome: "Fornecedor Alfa",
    descricao: "Monitor 24 polegadas",
    unidade: "un",
    preco: 700,
    prazoDias: 5,
    data: "2026-11-01",
    origem: "manual",
  };
}

describe("calcularPrecoSugerido: concorrentes", () => {
  it("sem amostras o teto é o próprio estimado e o cálculo pede a busca", () => {
    const r = calcularPrecoSugerido(entrada({ concorrentes: null }));
    expect(r.teto).toBe(1500);
    expect(r.faltando.join(" ")).toContain("Busque contratações parecidas");
  });

  it("com desconto médio, o teto cai e pode mudar o veredito", () => {
    const sem = calcularPrecoSugerido(entrada({ valorEstimado: 1500 }));
    const com = calcularPrecoSugerido(entrada({ valorEstimado: 1500, concorrentes: concorrentes({ descontoMedioPct: 20 }) }));
    expect(sem.veredito).toBe("vale");
    expect(com.teto).toBe(1200);
    expect(com.veredito).toBe("apertado");
    expect(com.fontes.join(" ")).toContain("desconto médio de 20%");
  });

  it("desconto muito alto leva o teto abaixo do piso: não vale", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: 1500, concorrentes: concorrentes({ descontoMedioPct: 40 }) }));
    expect(r.teto).toBe(900);
    expect(r.veredito).toBe("nao-vale");
  });

  it("desconto negativo (homologou acima do estimado) não passa do estimado", () => {
    const r = calcularPrecoSugerido(entrada({ valorEstimado: 1500, concorrentes: concorrentes({ descontoMedioPct: -10 }) }));
    expect(r.teto).toBe(1500);
  });

  it("amostras sem estimado para calcular desconto não mexem no teto", () => {
    const r = calcularPrecoSugerido(
      entrada({ concorrentes: concorrentes({ descontoMedioPct: null, amostrasComDesconto: 0 }) }),
    );
    expect(r.teto).toBe(1500);
  });

  it("poucas amostras entram no teto, mas aparecem em faltando", () => {
    const r = calcularPrecoSugerido(entrada({ concorrentes: concorrentes({ amostrasComDesconto: 1, amostras: 1 }) }));
    expect(r.teto).toBe(1200);
    expect(r.faltando.join(" ")).toContain("Poucas contratações parecidas (1)");
  });
});

describe("calcularPrecoSugerido: confiança", () => {
  it("alta: mercado com 3 ou mais amostras, margem do CNAE e mais de uma cotação", () => {
    const r = calcularPrecoSugerido(
      entrada({
        concorrentes: concorrentes(),
        cotacoes: resumo([cotacao({ criadoEm: "2026-11-01T10:00:00.000Z" }), cotacao({ criadoEm: "2026-11-02T10:00:00.000Z" })]),
      }),
    );
    expect(r.confianca).toBe("alta");
    expect(r.faltando).toEqual([]);
  });

  it("média: só custo, estimado e margem do CNAE", () => {
    expect(calcularPrecoSugerido(entrada()).confianca).toBe("media");
  });

  it("baixa: sem CNAE conhecido, uma cotação e sem concorrentes; a margem vem da cotação", () => {
    const r = calcularPrecoSugerido(entrada({ cnaes: ["00.00-0-00"] }));
    expect(r.confianca).toBe("baixa");
    expect(r.margemAlvoPct).toBe(20);
    expect(r.alvo).toBe(centavos(1000 / 0.76));
    expect(r.fontes.join(" ")).toContain("da última cotação");
  });

  it("usa o primeiro CNAE casado que tenha margem conhecida", () => {
    const r = calcularPrecoSugerido(entrada({ cnaes: ["00.00-0-00", CNAE_INFORMATICA] }));
    expect(r.margemAlvoPct).toBe(18);
  });
});

describe("precoSugeridoDoItem", () => {
  const item = {
    id: "12345678000190-1-100/2026",
    objeto: "Aquisição de monitores led polegadas",
    uf: "RJ",
    valorEstimado: 1500,
    frente: "produtos" as const,
    cnaes: [CNAE_INFORMATICA],
  };

  function amostra(id: string): AmostraConcorrente {
    return {
      idPncp: id,
      objeto: "Monitores led de 24 polegadas",
      uf: "RJ",
      orgao: "Prefeitura",
      valorEstimado: 1000,
      valorHomologado: 800,
      publicadaEm: "2026-10-01T00:00:00.000Z",
      link: "https://pncp.gov.br",
    };
  }

  it("usa as amostras em cache para o teto", () => {
    const r = precoSugeridoDoItem(item, "me", resumo(), [amostra("a"), amostra("b"), amostra("c")], []);
    expect(r.teto).toBe(1200);
    expect(r.veredito).toBe("apertado");
  });

  it("ignora a própria licitação nas amostras", () => {
    const r = precoSugeridoDoItem(item, "me", resumo(), [amostra(item.id)], []);
    expect(r.teto).toBe(1500);
  });

  it("sem cotação não olha concorrentes e procura preço de fornecedor", () => {
    const r = precoSugeridoDoItem(item, "me", null, [amostra("a")], [{ ...precoFornecedor(), descricao: "Monitor led polegadas" }]);
    expect(r.veredito).toBe("sem-custo");
    expect(r.faltando.join(" ")).toContain("Fornecedor Alfa");
  });
});
