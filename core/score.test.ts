import { describe, expect, it } from "vitest";
import { calcularScore, limiteMeiAnual } from "./score";
import type { Criterio, CriterioId, Frente, Oportunidade } from "./types";

const AGORA = new Date("2026-11-10T12:00:00-03:00");

function oportunidade(parcial: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "00000000000000-1-000001/2026",
    objeto: "Manutenção de computadores e impressoras",
    valorEstimado: 5000,
    orgao: "PREFEITURA DE NOVA IGUAÇU",
    orgaoCnpj: "00000000000000",
    unidade: "Secretaria",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "nova-iguacu",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: "2026-11-09T08:00:00-03:00",
    dataEncerramento: "2026-11-20T08:00:00-03:00",
    anoCompra: 2026,
    sequencialCompra: 1,
    linkPncp: "https://pncp.gov.br/app/editais/00000000000000/2026/1",
    linkOrigem: null,
    ...parcial,
  };
}

function criterio(o: Oportunidade, frente: Frente, id: CriterioId): Criterio {
  const c = calcularScore(o, frente, AGORA).criterios.find((x) => x.id === id);
  if (!c) throw new Error(`critério ${id} ausente`);
  return c;
}

describe("limiteMeiAnual", () => {
  it("2026 conta novembro e dezembro: 13.500", () => {
    expect(limiteMeiAnual(2026)).toBe(13500);
  });
  it("2027 em diante: 81.000", () => {
    expect(limiteMeiAnual(2027)).toBe(81000);
    expect(limiteMeiAnual(2030)).toBe(81000);
  });
  it("antes da abertura não há limite", () => {
    expect(limiteMeiAnual(2025)).toBe(0);
  });
});

describe("critério cnae", () => {
  it("30 pontos quando casa na frente ativa", () => {
    const c = criterio(oportunidade(), "servicos", "cnae");
    expect(c.pontos).toBe(30);
    expect(c.maximo).toBe(30);
  });

  it("12 pontos quando casa só na outra frente", () => {
    expect(criterio(oportunidade(), "produtos", "cnae").pontos).toBe(12);
    const toner = oportunidade({ objeto: "Aquisição de toner" });
    expect(criterio(toner, "servicos", "cnae").pontos).toBe(12);
  });

  it("0 pontos sem match", () => {
    const o = oportunidade({ objeto: "Serviço de seguro para viaturas" });
    expect(criterio(o, "servicos", "cnae").pontos).toBe(0);
  });

  it("lista os CNAEs casados e a frente casada", () => {
    const s = calcularScore(oportunidade(), "produtos", AGORA);
    expect(s.cnaesCasados).toEqual(["95.11-8-00"]);
    expect(s.frenteCasada).toBe("servicos");
    expect(calcularScore(oportunidade(), "servicos", AGORA).frenteCasada).toBe("servicos");
    expect(calcularScore(oportunidade({ objeto: "Seguro" }), "servicos", AGORA).frenteCasada).toBeNull();
  });
});

describe("trava de nogo", () => {
  it("sem match vira nogo mesmo com total alto", () => {
    const o = oportunidade({ objeto: "Serviço de seguro para viaturas" });
    const s = calcularScore(o, "servicos", AGORA);
    expect(s.total).toBe(70);
    expect(s.total).toBeGreaterThanOrEqual(50);
    expect(s.faixa).toBe("nogo");
  });
});

describe("critério modalidade", () => {
  it("dispensa 25, pregão 10", () => {
    expect(criterio(oportunidade({ modalidadeId: 8 }), "servicos", "modalidade").pontos).toBe(25);
    expect(criterio(oportunidade({ modalidadeId: 6 }), "servicos", "modalidade").pontos).toBe(10);
  });
  it("o motivo da dispensa é claro", () => {
    expect(criterio(oportunidade(), "servicos", "modalidade").motivo).toBe(
      "Dispensa eletrônica: disputa simples e rápida",
    );
  });
});

describe("critério local", () => {
  it.each([
    ["nova-iguacu", 20],
    ["baixada", 16],
    ["capital", 14],
    ["rj", 6],
    ["fora-rj", 0],
  ] as const)("serviços em %s vale %i", (regiao, pontos) => {
    expect(criterio(oportunidade({ regiao }), "servicos", "local").pontos).toBe(pontos);
  });

  it.each([
    ["nova-iguacu", 20],
    ["baixada", 20],
    ["capital", 20],
    ["rj", 20],
    ["fora-rj", 8],
  ] as const)("produtos em %s vale %i", (regiao, pontos) => {
    expect(criterio(oportunidade({ regiao }), "produtos", "local").pontos).toBe(pontos);
  });
});

describe("critério documentação", () => {
  it("dispensa 15 e pregão 6, sempre a confirmar", () => {
    const d = criterio(oportunidade({ modalidadeId: 8 }), "servicos", "documentacao");
    const p = criterio(oportunidade({ modalidadeId: 6 }), "servicos", "documentacao");
    expect(d.pontos).toBe(15);
    expect(p.pontos).toBe(6);
    expect(d.aConfirmar).toBe(true);
    expect(p.aConfirmar).toBe(true);
  });
});

describe("critério valor", () => {
  it("até o limite vale 10 (encerra em 2026: limite 13.500)", () => {
    const c = criterio(oportunidade({ valorEstimado: 13500 }), "servicos", "valor");
    expect(c.pontos).toBe(10);
    expect(c.aConfirmar).toBe(false);
  });
  it("abaixo de R$ 1.500 vale 6: retorno baixo para o esforço", () => {
    const c = criterio(oportunidade({ valorEstimado: 1499.99 }), "servicos", "valor");
    expect(c.pontos).toBe(6);
    expect(c.motivo).toContain("retorno é baixo para o esforço");
    expect(criterio(oportunidade({ valorEstimado: 1500 }), "servicos", "valor").pontos).toBe(10);
  });
  it("acima do teto anual vale 0 mesmo em 2027, quando 2x o limite seria 162.000", () => {
    const o = oportunidade({ valorEstimado: 100000, dataEncerramento: "2027-02-10T08:00:00-03:00" });
    expect(criterio(o, "servicos", "valor").pontos).toBe(0);
  });
  it("até 2x o limite vale 5", () => {
    expect(criterio(oportunidade({ valorEstimado: 27000 }), "servicos", "valor").pontos).toBe(5);
  });
  it("acima de 2x o limite vale 0", () => {
    expect(criterio(oportunidade({ valorEstimado: 27000.01 }), "servicos", "valor").pontos).toBe(0);
  });
  it("valor nulo vale 5 e fica a confirmar", () => {
    const c = criterio(oportunidade({ valorEstimado: null }), "servicos", "valor");
    expect(c.pontos).toBe(5);
    expect(c.aConfirmar).toBe(true);
  });
  it("usa o limite do ano do encerramento (2027: 81.000)", () => {
    const o = oportunidade({ valorEstimado: 20000, dataEncerramento: "2027-01-10T08:00:00-03:00" });
    expect(criterio(o, "servicos", "valor").pontos).toBe(10);
    const dezembro = oportunidade({ valorEstimado: 20000, dataEncerramento: "2026-12-10T08:00:00-03:00" });
    expect(criterio(dezembro, "servicos", "valor").pontos).toBe(5);
  });
});

describe("faixas e total", () => {
  it("dispensa perfeita em Nova Iguaçu soma 100 e é go", () => {
    const s = calcularScore(oportunidade(), "servicos", AGORA);
    expect(s.total).toBe(100);
    expect(s.faixa).toBe("go");
    expect(s.criterios.map((c) => c.id)).toEqual(["cnae", "modalidade", "local", "documentacao", "valor"]);
  });

  it("75 é go", () => {
    // 30 + 10 + 20 + 6 + 10 = 76 com pregão em Nova Iguaçu
    const s = calcularScore(oportunidade({ modalidadeId: 6 }), "servicos", AGORA);
    expect(s.total).toBe(76);
    expect(s.faixa).toBe("go");
  });

  it("de 50 a 74 é atenção", () => {
    // pregão na capital: 30 + 10 + 14 + 6 + 10 = 70
    const s = calcularScore(oportunidade({ modalidadeId: 6, regiao: "capital" }), "servicos", AGORA);
    expect(s.total).toBe(70);
    expect(s.faixa).toBe("atencao");
  });

  it("acima do teto anual do MEI nunca é go, mesmo com 90 pontos", () => {
    // dispensa em Nova Iguaçu de R$ 117 mil: 30 + 25 + 20 + 15 + 0 = 90
    const s = calcularScore(oportunidade({ valorEstimado: 117118.11 }), "servicos", AGORA);
    expect(s.total).toBe(90);
    expect(s.faixa).toBe("atencao");
  });

  it("abaixo de 50 é nogo", () => {
    // pregão fora do RJ com valor alto: 30 + 10 + 0 + 6 + 0 = 46
    const o = oportunidade({ modalidadeId: 6, regiao: "fora-rj", valorEstimado: 100000 });
    const s = calcularScore(o, "servicos", AGORA);
    expect(s.total).toBe(46);
    expect(s.faixa).toBe("nogo");
  });

  it("é pura: mesma entrada, mesma saída", () => {
    const o = oportunidade();
    expect(calcularScore(o, "servicos", AGORA)).toEqual(calcularScore(o, "servicos", AGORA));
  });
});

describe("critério cnae: força do casamento", () => {
  it("termo forte sozinho vale 30", () => {
    expect(criterio(oportunidade({ objeto: "Instalação de CFTV" }), "servicos", "cnae").pontos).toBe(30);
  });
  it("termo fraco sozinho vale 22 e dois termos fracos valem 30", () => {
    const fraco = oportunidade({ objeto: "Aquisição de brindes" });
    expect(criterio(fraco, "produtos", "cnae").pontos).toBe(22);
    const dois = oportunidade({ objeto: "Aquisição de brindes e caneca" });
    expect(criterio(dois, "produtos", "cnae").pontos).toBe(30);
  });
  it("termo contido em outro mais longo não conta em dobro", () => {
    const fracoComposto = oportunidade({ objeto: "Aquisição de material de informática" });
    expect(criterio(fracoComposto, "produtos", "cnae").pontos).toBe(22);
  });
});

describe("alertas", () => {
  it("fecha em menos de 6 h: alerta e nunca go", () => {
    const o = oportunidade({ dataEncerramento: "2026-11-10T16:00:00-03:00" });
    const s = calcularScore(o, "servicos", AGORA);
    expect(s.total).toBe(100);
    expect(s.faixa).toBe("atencao");
    expect(s.alertas).toContain("Fecha em menos de 6 h: pouco tempo para montar proposta");
  });
  it("fecha em mais de 6 h: sem alerta de prazo", () => {
    const o = oportunidade({ dataEncerramento: "2026-11-10T19:00:00-03:00" });
    const s = calcularScore(o, "servicos", AGORA);
    expect(s.faixa).toBe("go");
    expect(s.alertas).toBeUndefined();
  });
  it("valor acima do teto anual do MEI", () => {
    const s = calcularScore(oportunidade({ valorEstimado: 90000 }), "servicos", AGORA);
    expect(s.alertas).toContain("Valor acima do teto anual do MEI");
  });
  it("casou só com a outra frente", () => {
    const s = calcularScore(oportunidade({ objeto: "Aquisição de toner" }), "servicos", AGORA);
    expect(s.alertas).toContain("Casou só com a outra frente (produtos)");
    const t = calcularScore(oportunidade(), "produtos", AGORA);
    expect(t.alertas).toContain("Casou só com a outra frente (serviços)");
  });
});

type CasoReal = readonly [string, Partial<Oportunidade>, Frente];

describe("objetos reais do PNCP (novembro de 2026)", () => {
  const altos: ReadonlyArray<CasoReal> = [
    [
      "instalação de CFTV, dispensa na capital",
      {
        objeto:
          "CONTRATAÇÃO DE EMPRESA ESPECIALIZADA NO SERVIÇO DE INSTALAÇÃO DE CIRCUITO DE CFTV, CONFORME CONDIÇÕES E EXIGÊNCIAS ESTABELECIDAS EM TERMO DE REFERÊNCIA E SEUS ANEXOS.",
        valorEstimado: 40194.03,
        regiao: "capital",
      },
      "servicos",
    ],
    [
      "rede lógica e periféricos, dispensa no interior",
      {
        objeto:
          "[LICITANET] - aquisição de materiais de infraestrutura de rede lógica e periféricos de informática, a fim de atender as demandas da Secretaria Municipal de Saúde, conforme condições e exigências estabelecidas neste Aviso de Contratação Direta e seus anexos",
        valorEstimado: 9915.86,
        regiao: "rj",
      },
      "servicos",
    ],
    [
      "toner e cartuchos de tinta, dispensa na capital",
      {
        objeto:
          "Aquisição dematerial de TIC (Toner,cartuchos de tintae repetidor de sinal Wi fi) para atender ademanda da Diretoria de Fabricação,conforme o DFD nª202/2026",
        valorEstimado: 7739.08,
        regiao: "capital",
      },
      "produtos",
    ],
    [
      "notebooks, dispensa no interior",
      {
        objeto:
          "a Aquisição de 03 (três) notebooks novos, de primeiro uso, com fonte de alimentação bivolt, destinados às atividades administrativas, operacionais e de apoio técnico da Secretaria Municipal de Defesa Civil de Barra do Piraí/RJ, conforme quantidades e especificações do termo de referência.",
        valorEstimado: 14307.3,
        regiao: "rj",
      },
      "produtos",
    ],
  ];

  it.each(altos)("pontua alto: %s", (_nome, parcial, frente) => {
    const s = calcularScore(oportunidade({ ...parcial, modalidadeId: 8 }), frente, AGORA);
    expect(s.frenteCasada).toBe(frente);
    expect(s.criterios[0].pontos).toBe(30);
    expect(s.total).toBeGreaterThanOrEqual(80);
    expect(s.faixa).toBe("go");
  });

  const falsos: ReadonlyArray<CasoReal> = [
    [
      "manutenção de subestação de média tensão em Brasília",
      {
        objeto:
          "Contratação de serviços de engenharia para manutenção preventiva e corretiva de equipamentos, componentes e demais acessórios constituintes do sistema elétrico de média tensão da Subestação da Superintendência do Arquivo Nacional - SUREG localizada em Brasília-DF, com fornecimento de materiais, mão de obra especializada e análise físico-química do óleo isolante nos termos da tabela abaixo, conforme condições e exigências estabelecidas neste instrumento.",
        valorEstimado: 117118.11,
        regiao: "fora-rj",
        modalidadeId: 8,
      },
      "servicos",
    ],
    [
      "reforma de subestações do hospital da Marinha",
      {
        objeto:
          "Contratação de empresa de engenharia para realizar serviço de reforma das subestações 01 e PCF do HNMD, com restabelecimento da linha de distribuição aérea que as interliga e instalação de circuito nos termos da tabela abaixo, alimentador da subestação 01, com fornecimento de materiais e equipamentos.",
        valorEstimado: 2509632.81,
        regiao: "capital",
        modalidadeId: 6,
      },
      "servicos",
    ],
    [
      "transporte escolar em Vassouras (o município casa com vassoura)",
      {
        objeto:
          "Contratação de serviços de transporte escolar em área urbana e rural dos estudantes do Município de Vassouras do ensino fundamental e da educação infantil das escolas e creches do Município.",
        valorEstimado: 3984389.44,
        regiao: "rj",
        modalidadeId: 6,
      },
      "produtos",
    ],
    [
      "manutenção de elevadores com monitoramento por circuito fechado de televisão",
      {
        objeto:
          "Contratação de serviços de manutenção preventiva, preditiva, corretiva, conservação e assistência técnica de 16 (dezesseis) elevadores elétricos da fabricante ThyssenKrupp que possuem tecnologia de antecipação de chamadas e sistema regenerativo de energia, e 02 (dois) elevadores hidráulicos, além de 07 (sete) casas de máquinas e seus equipamentos e acessórios, e serviço de monitoramento de Câmeras dos elevadores, via circuito fechado de televisão (CTFV), SERVIÇOS A SEREM EXECUTADOS COM REGIME DE DEDICAÇÃO EXCLUSIVA",
        valorEstimado: 2104555.02,
        regiao: "capital",
        modalidadeId: 6,
      },
      "servicos",
    ],
  ];

  it.each(falsos)("cai: %s", (_nome, parcial, frente) => {
    const s = calcularScore(oportunidade(parcial), frente, AGORA);
    expect(s.frenteCasada).toBeNull();
    expect(s.criterios[0].pontos).toBe(0);
    expect(s.faixa).toBe("nogo");
  });

  it("internet por banda larga (provedor) não casa com redes", () => {
    const o = oportunidade({
      objeto:
        "Serviço de Conexão à Internet (SCI/SCM) via banda larga de fibra óptica (mínimo de 530 Mbps), sem restrição de franquia de tráfego, com suporte a Wi-Fi e roteador fornecido em comodato.",
      valorEstimado: null,
      regiao: "capital",
    });
    expect(calcularScore(o, "servicos", AGORA).frenteCasada).toBeNull();
  });
});
