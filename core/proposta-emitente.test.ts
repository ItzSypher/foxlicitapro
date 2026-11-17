import { describe, expect, it } from "vitest";
import { PERFIL_ORIGEM } from "./empresa";
import { emitenteDoPerfil, textoRepresentante } from "./proposta-emitente";

describe("emitenteDoPerfil", () => {
  it("deixa vazios os dados da proposta que faltam no perfil", () => {
    const e = emitenteDoPerfil(PERFIL_ORIGEM);
    expect(e.representanteCpf).toBe("");
    expect(e.representanteRg).toBe("");
    expect(e.dadosBancarios).toBe("");
    expect(e.assinatura).toBe("");
  });

  it("copia representante, dados bancários e assinatura do perfil", () => {
    const assinatura = "data:image/png;base64,AAAA";
    const e = emitenteDoPerfil({
      ...PERFIL_ORIGEM,
      representanteCpf: "123.456.789-00",
      representanteRg: "12.345.678-9",
      dadosBancarios: "Banco X, ag. 1, conta 2",
      assinatura,
    });
    expect(e.representanteCpf).toBe("123.456.789-00");
    expect(e.representanteRg).toBe("12.345.678-9");
    expect(e.dadosBancarios).toBe("Banco X, ag. 1, conta 2");
    expect(e.assinatura).toBe(assinatura);
  });
});

describe("textoRepresentante", () => {
  it("junta nome, CPF e RG", () => {
    expect(textoRepresentante({ responsavel: "Ana", representanteCpf: "111", representanteRg: "222" })).toBe("Ana | CPF 111 | RG 222");
  });

  it("omite as partes vazias", () => {
    expect(textoRepresentante({ responsavel: "Ana", representanteCpf: "", representanteRg: "222" })).toBe("Ana | RG 222");
    expect(textoRepresentante({ responsavel: "", representanteCpf: "111", representanteRg: "" })).toBe("CPF 111");
  });

  it("devolve vazio quando não há nenhuma parte", () => {
    expect(textoRepresentante({ responsavel: "", representanteCpf: "", representanteRg: "" })).toBe("");
  });
});
