import { describe, expect, it } from "vitest";
import {
  AssinaturaClienteSchema,
  ALFABETO_CODIGO,
  DadosAtestadoSchema,
  conteudoParaHash,
  cpfValido,
  gerarCodigo,
  lerValor,
  linkWhatsApp,
  mensagemWhatsAppAtestado,
  normalizarCodigo,
  numerosInventados,
  paragrafosDoTexto,
  podeAssinar,
  podeCancelar,
  podeEditar,
  telefoneDoContato,
  textoPadraoAtestado,
  transicaoValida,
  type ConteudoAssinado,
} from "./atestados";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

const dadosOk = {
  clienteNome: "Prefeitura Exemplo",
  clienteCnpj: "70.048.886/0001-29",
  clienteEndereco: "",
  responsavelNome: "",
  responsavelCargo: "",
  responsavelContato: "",
  objeto: "desenvolvimento de site institucional e manutenção mensal",
  areas: ["Site", "site", "manutencao"],
  periodoInicio: "2026-01-10",
  periodoFim: "2026-06-30",
  valor: "12.500,00",
  texto: "Atestamos, para os devidos fins, que a empresa Fox atendeu.",
};

describe("DadosAtestadoSchema", () => {
  it("normaliza vazios, CNPJ, áreas e valor", () => {
    const r = DadosAtestadoSchema.parse(dadosOk);
    expect(r.clienteCnpj).toBe("70048886000129");
    expect(r.clienteEndereco).toBeNull();
    expect(r.areas).toEqual(["site", "manutencao"]);
    expect(r.valor).toBe(12500);
  });

  it("rejeita CNPJ inválido, período invertido e objeto curto", () => {
    expect(DadosAtestadoSchema.safeParse({ ...dadosOk, clienteCnpj: "11.111.111/1111-11" }).success).toBe(false);
    expect(DadosAtestadoSchema.safeParse({ ...dadosOk, periodoInicio: "2026-07-01", periodoFim: "2026-06-01" }).success).toBe(false);
    expect(DadosAtestadoSchema.safeParse({ ...dadosOk, objeto: "ab" }).success).toBe(false);
    expect(DadosAtestadoSchema.safeParse({ ...dadosOk, periodoInicio: "2026-02-31" }).success).toBe(false);
  });

  it("aceita CNPJ e datas em branco", () => {
    const r = DadosAtestadoSchema.parse({ ...dadosOk, clienteCnpj: "", periodoInicio: "", periodoFim: "", valor: "" });
    expect(r.clienteCnpj).toBeNull();
    expect(r.periodoInicio).toBeNull();
    expect(r.valor).toBeNull();
  });
});

describe("lerValor", () => {
  it("entende formatos brasileiros", () => {
    expect(lerValor("R$ 1.234,56")).toBe(1234.56);
    expect(lerValor("1.234")).toBe(1234);
    expect(lerValor("99,9")).toBe(99.9);
    expect(lerValor("")).toBeNull();
    expect(lerValor("abc")).toBeNaN();
  });
});

describe("AssinaturaClienteSchema", () => {
  const base = { nome: "Maria Souza", cargo: "Secretária", documento: "", assinatura: PNG, declaracao: true };
  it("aceita sem CPF e valida o CPF quando vem", () => {
    expect(AssinaturaClienteSchema.safeParse(base).success).toBe(true);
    expect(AssinaturaClienteSchema.safeParse({ ...base, documento: "529.982.247-25" }).success).toBe(true);
    expect(AssinaturaClienteSchema.safeParse({ ...base, documento: "111.111.111-11" }).success).toBe(false);
  });
  it("exige a declaração e uma imagem PNG", () => {
    expect(AssinaturaClienteSchema.safeParse({ ...base, declaracao: false }).success).toBe(false);
    expect(AssinaturaClienteSchema.safeParse({ ...base, assinatura: "texto" }).success).toBe(false);
  });
  it("cpfValido confere os dígitos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("52998224724")).toBe(false);
  });
});

describe("textoPadraoAtestado", () => {
  const entrada = {
    emissoraRazaoSocial: "Fox TI Ltda",
    emissoraCnpj: "70048886000129",
    clienteNome: "Prefeitura Exemplo",
    clienteCnpj: "11222333000181",
    objeto: "criação de site institucional.",
    periodoInicio: "2026-01-10",
    periodoFim: "2026-06-30",
    valor: 12500,
  };

  it("monta o modelo formal com todos os dados", () => {
    const t = textoPadraoAtestado(entrada);
    expect(t).toContain("Atestamos, para os devidos fins, que a empresa Fox TI Ltda, inscrita no CNPJ sob o nº 70.048.886/0001-29");
    expect(t).toContain("prestou a esta Prefeitura Exemplo, inscrita no CNPJ sob o nº 11.222.333/0001-81, os serviços de criação de site institucional, no período de 10/01/2026 a 30/06/2026, no valor de R$ 12.500,00 (doze mil e quinhentos reais).");
    expect(t).toContain("nada constando que desabone a empresa");
    expect(paragrafosDoTexto(t)).toHaveLength(3);
  });

  it("omite o que não foi informado", () => {
    const t = textoPadraoAtestado({ ...entrada, clienteCnpj: null, periodoInicio: null, periodoFim: null, valor: null });
    expect(t).not.toContain("no valor");
    expect(t).not.toContain("período");
    expect(t).toContain("prestou a esta Prefeitura Exemplo, os serviços");
  });
});

describe("conteudoParaHash", () => {
  const base: ConteudoAssinado = {
    empresaId: "e1",
    clienteNome: "Cliente",
    clienteCnpj: "11.222.333/0001-81",
    objeto: "site",
    periodoInicio: "2026-01-01",
    periodoFim: null,
    valor: 100,
    texto: "Texto\r\nfinal ",
    assinanteNome: "Maria",
    assinanteCargo: "Diretora",
    assinadoEm: "2026-11-25T15:00:00.000Z",
  };

  it("é estável e ignora CRLF, espaços nas pontas e formato do CNPJ", () => {
    const a = conteudoParaHash(base);
    const b = conteudoParaHash({ ...base, texto: "Texto\nfinal", clienteCnpj: "11222333000181", valor: 100.0 });
    expect(a).toBe(b);
    expect(conteudoParaHash(base)).toBe(a);
  });

  it("muda quando qualquer fato muda", () => {
    const a = conteudoParaHash(base);
    expect(conteudoParaHash({ ...base, valor: 101 })).not.toBe(a);
    expect(conteudoParaHash({ ...base, texto: "Outro" })).not.toBe(a);
    expect(conteudoParaHash({ ...base, assinanteNome: "João" })).not.toBe(a);
    expect(conteudoParaHash({ ...base, assinadoEm: "2026-11-25T15:00:01.000Z" })).not.toBe(a);
  });
});

describe("gerarCodigo", () => {
  it("gera 8 caracteres só do alfabeto sem ambíguos", () => {
    const c = gerarCodigo([0, 1, 2, 3, 250, 251, 252, 255]);
    expect(c).toHaveLength(8);
    expect([...c].every((x) => ALFABETO_CODIGO.includes(x))).toBe(true);
    expect(/[01OI]/.test(ALFABETO_CODIGO)).toBe(false);
    expect(ALFABETO_CODIGO).toHaveLength(32);
  });
  it("cobre todo o alfabeto e exige bytes suficientes", () => {
    const todos = gerarCodigo([0, 8, 16, 24, 31, 5, 12, 20]);
    expect(todos).toHaveLength(8);
    expect(() => gerarCodigo([1, 2, 3])).toThrow();
  });
  it("normalizarCodigo aceita hífen e minúsculas", () => {
    expect(normalizarCodigo("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizarCodigo("ABCD-EF01")).toBeNull();
    expect(normalizarCodigo("ABC")).toBeNull();
  });
});

describe("status", () => {
  it("segue rascunho, aguardando e assinado", () => {
    expect(transicaoValida("rascunho", "aguardando")).toBe(true);
    expect(transicaoValida("aguardando", "assinado")).toBe(true);
    expect(transicaoValida("rascunho", "assinado")).toBe(false);
    expect(transicaoValida("assinado", "cancelado")).toBe(false);
    expect(transicaoValida("cancelado", "aguardando")).toBe(false);
  });
  it("só edita e cancela antes da assinatura", () => {
    expect(podeEditar("rascunho")).toBe(true);
    expect(podeEditar("aguardando")).toBe(true);
    expect(podeEditar("assinado")).toBe(false);
    expect(podeCancelar("aguardando")).toBe(true);
    expect(podeCancelar("assinado")).toBe(false);
  });
  it("assinar exige link aguardando e dentro do prazo", () => {
    const agora = new Date("2026-11-25T12:00:00Z");
    expect(podeAssinar("aguardando", new Date("2026-12-01T00:00:00Z"), agora)).toBe(true);
    expect(podeAssinar("aguardando", new Date("2026-11-01T00:00:00Z"), agora)).toBe(false);
    expect(podeAssinar("aguardando", null, agora)).toBe(false);
    expect(podeAssinar("assinado", new Date("2026-12-01T00:00:00Z"), agora)).toBe(false);
  });
});

describe("assistente e envio", () => {
  it("detecta números que não estavam nos dados", () => {
    const dados = "Valor: R$ 12.500,00 em 10/01/2026";
    expect(numerosInventados("Pagos R$ 12.500,00 em 10/01/2026.", dados)).toEqual([]);
    expect(numerosInventados("Foram 40 horas e R$ 99.999,00.", dados)).toEqual(["40", "9999900"]);
  });

  it("monta o link do WhatsApp", () => {
    const msg = mensagemWhatsAppAtestado({ cliente: "Prefeitura", emissora: "Fox TI", link: "https://x.test/atestado/abc", responsavel: "Maria" });
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("https://x.test/atestado/abc");
    expect(linkWhatsApp(msg, "(21) 99999-0000")).toMatch(/^https:\/\/wa\.me\/5521999990000\?text=/);
    expect(linkWhatsApp(msg, null)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(telefoneDoContato("a@b.com")).toBeNull();
    expect(telefoneDoContato("21 99999-0000")).toBe("21999990000");
  });
});
