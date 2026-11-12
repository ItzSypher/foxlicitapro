import { describe, expect, it } from "vitest";
import { resumirObjeto } from "./objeto";

describe("resumirObjeto: aberturas", () => {
  const casos: ReadonlyArray<[string, string]> = [
    [
      "A presente contratação tem por finalidade a aquisição de material de escritório.",
      "Aquisição de material de escritório",
    ],
    [
      "A PRESENTE CONTRATAÇÃO TEM POR OBJETO A AQUISIÇÃO DE EXTINTORES",
      "Aquisição de extintores",
    ],
    [
      "O objeto da presente contratação é a prestação de serviços de limpeza predial",
      "Prestação de serviços de limpeza predial",
    ],
    [
      "O objeto da presente licitação é a eventual contratação de empresa especializada para prestação de serviços de apoio administrativo",
      "Prestação de serviços de apoio administrativo",
    ],
    [
      "Constitui objeto da presente licitação a escolha da proposta mais vantajosa para a contratação de empresa especializada em manutenção de elevadores",
      "Manutenção de elevadores",
    ],
    [
      "Contratação de empresa especializada para a prestação de serviços de vigilância armada",
      "Prestação de serviços de vigilância armada",
    ],
    ["Contratação de empresa para fornecimento de uniformes", "Fornecimento de uniformes"],
    [
      "Contratação de empresa especializada na manutenção de ar-condicionado",
      "Manutenção de ar-condicionado",
    ],
    [
      "Contratação de empresa especializada no fornecimento de refeições",
      "Fornecimento de refeições",
    ],
    [
      "Registro de preços para a eventual aquisição de pneus",
      "Aquisição de pneus",
    ],
    [
      "Registro de preços para futura e eventual contratação de empresa especializada em material hospitalar",
      "Material hospitalar",
    ],
    ["REGISTRO DE PREÇO VISANDO A AQUISIÇÃO DE TINTAS", "Aquisição de tintas"],
    ["Visando a aquisição de cadeiras para o auditório", "Aquisição de cadeiras para o auditório"],
    ["Trata-se de contratação de serviços de jardinagem", "Serviços de jardinagem"],
    ["OBJETO: Aquisição de gêneros alimentícios", "Aquisição de gêneros alimentícios"],
    [
      "Dispensa de licitação para aquisição de equipamentos de informática",
      "Aquisição de equipamentos de informática",
    ],
    ["[LICITANET] - Contratação de serviços de engenharia", "Serviços de engenharia"],
    [
      "RSD-020116/006321/2026 - Registro de preços para aquisição de cadeiras",
      "Aquisição de cadeiras",
    ],
    ["Formação de Ata de Registro de Preços, para futura aquisição de pneus", "Aquisição de pneus"],
  ];

  it.each(casos)("%s", (entrada, esperado) => {
    expect(resumirObjeto(entrada)).toBe(esperado);
  });

  it("aceita texto sem acento e em minúsculas", () => {
    expect(resumirObjeto("a presente contratacao tem por objeto a aquisicao de colchoes")).toBe(
      "Aquisicao de colchoes",
    );
  });
});

describe("resumirObjeto: caudas", () => {
  const casos: ReadonlyArray<[string, string]> = [
    [
      "Aquisição de microcomputadores, conforme especificações do Termo de Referência",
      "Aquisição de microcomputadores",
    ],
    [
      "Aquisição de mobiliário, conforme as condições estabelecidas neste edital",
      "Aquisição de mobiliário",
    ],
    [
      "Prestação de serviços de limpeza nos termos do Anexo I",
      "Prestação de serviços de limpeza",
    ],
    [
      "Aquisição de gás de cozinha de acordo com o Termo de Referência",
      "Aquisição de gás de cozinha",
    ],
    ["Aquisição de livros didáticos e seus anexos", "Aquisição de livros didáticos"],
    [
      "Prestação de serviço técnico especializado em atendimento médico pré-hospitalar",
      "Prestação de serviço técnico especializado em atendimento médico pré-hospitalar",
    ],
  ];

  it.each(casos)("%s", (entrada, esperado) => {
    expect(resumirObjeto(entrada)).toBe(esperado);
  });
});

describe("resumirObjeto: caixa e pontuação", () => {
  it("texto todo em maiúsculas vira frase normal", () => {
    expect(resumirObjeto("AQUISIÇÃO DE MATERIAL DE LIMPEZA PARA AS ESCOLAS")).toBe(
      "Aquisição de material de limpeza para as escolas",
    );
  });

  it("mantém siglas no texto em maiúsculas", () => {
    expect(
      resumirObjeto("CONTRATAÇÃO DE EMPRESA ESPECIALIZADA EM CFTV E TI PARA O PREVINI DO RJ"),
    ).toBe("CFTV e TI para o PREVINI do RJ");
  });

  it("recupera a maiúscula de nomes de município", () => {
    expect(resumirObjeto("AQUISIÇÃO DE MESAS PARA ESCOLAS DE NOVA IGUAÇU")).toBe(
      "Aquisição de mesas para escolas de Nova Iguaçu",
    );
  });

  it("não mexe nas siglas de um texto em caixa mista", () => {
    expect(resumirObjeto("Aquisição de EPI para a Guarda Municipal")).toBe(
      "Aquisição de EPI para a Guarda Municipal",
    );
  });

  it("primeira letra maiúscula e sem ponto final", () => {
    expect(resumirObjeto("  aquisição de papel A4.  ")).toBe("Aquisição de papel A4");
    expect(resumirObjeto("Compra de tinta para demarcação...")).toBe("Compra de tinta para demarcação");
  });

  it("junta espaços e quebras de linha", () => {
    expect(resumirObjeto("Aquisição   de\n  cadeiras")).toBe("Aquisição de cadeiras");
  });
});

describe("resumirObjeto: nunca devolve vazio", () => {
  it("cai para o original quando a abertura é o texto todo", () => {
    expect(resumirObjeto("Contratação de empresa")).not.toBe("");
    expect(resumirObjeto("Registro de preços para")).not.toBe("");
  });

  it("texto curto sem padrão volta como está", () => {
    expect(resumirObjeto("Pneus")).toBe("Pneus");
  });

  it("texto vazio volta vazio sem quebrar", () => {
    expect(resumirObjeto("")).toBe("");
    expect(resumirObjeto("   ")).toBe("");
  });

  it("não corta a cauda quando sobraria quase nada", () => {
    expect(resumirObjeto("Conforme edital").length).toBeGreaterThan(0);
  });
});
