import { describe, expect, it, vi } from "vitest";
import {
  ErroConsultaCnpj,
  cnpjValido,
  consultarCnpj,
  formatarCnae,
  formatarCnpj,
  frenteSugerida,
  mapearRespostaBrasilApi,
  regioesSugeridas,
} from "./brasilapi";

const CNPJ = "70048886000129";

const resposta = {
  cnpj: CNPJ,
  razao_social: "EMPRESA FICTICIA LTDA",
  nome_fantasia: "LOJA DO BAIRRO",
  porte: "MICRO EMPRESA",
  opcao_pelo_mei: false,
  uf: "rj",
  municipio: "NOVA IGUACU",
  data_inicio_atividade: "2020-03-15",
  cnae_fiscal: 9511800,
  cnae_fiscal_descricao: "Reparo e manutenção de computadores",
  cnaes_secundarios: [
    { codigo: 4751201, descricao: "Comércio varejista de equipamentos de informática" },
    { codigo: 9511800, descricao: "Repetido" },
    { codigo: 0, descricao: "Sem código" },
  ],
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "DAS FLORES",
  numero: "10",
  complemento: "",
  bairro: "CENTRO",
  cep: 26210000,
  ddd_telefone_1: "2133334444",
  email: "CONTATO@EXEMPLO.COM",
};

function respostaHttp(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("auxiliares de CNPJ e CNAE", () => {
  it("valida e formata o CNPJ", () => {
    expect(cnpjValido(CNPJ)).toBe(true);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
    expect(formatarCnpj(CNPJ)).toBe("70.048.886/0001-29");
  });

  it("formata o CNAE e sugere a frente", () => {
    expect(formatarCnae(9511800)).toBe("95.11-8-00");
    expect(frenteSugerida("47.51-2-01")).toBe("produtos");
    expect(frenteSugerida("95.11-8-00")).toBe("servicos");
  });

  it("sugere regiões pela UF", () => {
    expect(regioesSugeridas("RJ")).toEqual(["nova-iguacu", "baixada", "capital", "rj"]);
    expect(regioesSugeridas("SP")).toEqual(["fora-rj"]);
  });
});

describe("mapearRespostaBrasilApi", () => {
  it("mapeia os campos e tira CNAE repetido ou vazio", () => {
    const e = mapearRespostaBrasilApi(resposta);
    expect(e).toMatchObject({
      cnpj: CNPJ,
      razaoSocial: "EMPRESA FICTICIA LTDA",
      nomeFantasia: "Loja Do Bairro",
      porte: "me",
      uf: "RJ",
      municipio: "Nova Iguacu",
      dataAbertura: "2020-03-15",
      cep: "26210-000",
      email: "contato@exemplo.com",
    });
    expect(e.endereco).toBe("RUA DAS FLORES, 10, CENTRO");
    expect(e.cnaes.map((c) => [c.codigo, c.principal, c.frente])).toEqual([
      ["95.11-8-00", true, "servicos"],
      ["47.51-2-01", false, "produtos"],
    ]);
  });

  it("MEI vem da opção pelo MEI e porte pequeno vira EPP", () => {
    expect(mapearRespostaBrasilApi({ ...resposta, opcao_pelo_mei: true }).porte).toBe("mei");
    expect(mapearRespostaBrasilApi({ ...resposta, porte: "EMPRESA DE PEQUENO PORTE" }).porte).toBe("epp");
    expect(mapearRespostaBrasilApi({ ...resposta, porte: "DEMAIS" }).porte).toBe("demais");
  });

  it("recusa resposta sem o essencial", () => {
    expect(() => mapearRespostaBrasilApi({ cnpj: CNPJ })).toThrow(ErroConsultaCnpj);
    expect(() => mapearRespostaBrasilApi(null)).toThrow(ErroConsultaCnpj);
  });
});

describe("consultarCnpj", () => {
  it("consulta pela URL do CNPJ só com dígitos e devolve o mapeamento", async () => {
    const buscar = vi.fn().mockResolvedValue(respostaHttp(200, resposta));
    const e = await consultarCnpj("70.048.886/0001-29", buscar);
    expect(e.razaoSocial).toBe("EMPRESA FICTICIA LTDA");
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, init] = buscar.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(url.endsWith(`/${CNPJ}`)).toBe(true);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("não consulta CNPJ inválido", async () => {
    const buscar = vi.fn();
    await expect(consultarCnpj("123", buscar)).rejects.toThrow(/inválido/);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("trata 404, erro de servidor e falha de rede", async () => {
    await expect(consultarCnpj(CNPJ, vi.fn().mockResolvedValue(respostaHttp(404, {})))).rejects.toThrow(/não encontrado/);
    await expect(consultarCnpj(CNPJ, vi.fn().mockResolvedValue(respostaHttp(500, {})))).rejects.toThrow(/código 500/);
    await expect(consultarCnpj(CNPJ, vi.fn().mockRejectedValue(new Error("timeout")))).rejects.toThrow(/10 segundos/);
  });
});
