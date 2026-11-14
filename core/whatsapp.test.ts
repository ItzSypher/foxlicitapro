import { describe, expect, it } from "vitest";
import { formatarWhatsapp, normalizarWhatsapp } from "./whatsapp";

describe("normalizarWhatsapp", () => {
  it("aceita celular com máscara e coloca o 55", () => {
    expect(normalizarWhatsapp("(21) 99999-0000")).toBe("5521999990000");
    expect(normalizarWhatsapp("21 99999 0000")).toBe("5521999990000");
  });

  it("mantém o 55 quando já vem com DDI, com ou sem +", () => {
    expect(normalizarWhatsapp("+55 (21) 99999-0000")).toBe("5521999990000");
    expect(normalizarWhatsapp("5521999990000")).toBe("5521999990000");
  });

  it("tira o zero de operadora na frente do DDD", () => {
    expect(normalizarWhatsapp("021999990000")).toBe("5521999990000");
  });

  it("DDD 55 sem DDI não é confundido com o DDI", () => {
    expect(normalizarWhatsapp("55999990000")).toBe("5555999990000");
  });

  it("aceita número de 8 dígitos (fixo)", () => {
    expect(normalizarWhatsapp("(21) 3333-4444")).toBe("552133334444");
  });

  it("recusa o que não dá para confiar", () => {
    expect(normalizarWhatsapp("")).toBeNull();
    expect(normalizarWhatsapp("abc")).toBeNull();
    expect(normalizarWhatsapp("99999-0000")).toBeNull();
    expect(normalizarWhatsapp("(21) 89999-0000")).toBeNull();
    expect(normalizarWhatsapp("(10) 99999-0000")).toBeNull();
    expect(normalizarWhatsapp("+1 415 555 0100")).toBeNull();
    expect(normalizarWhatsapp("5521999990000123")).toBeNull();
  });
});

describe("formatarWhatsapp", () => {
  it("mostra DDD e número separados", () => {
    expect(formatarWhatsapp("5521999990000")).toBe("(21) 99999-0000");
    expect(formatarWhatsapp("552133334444")).toBe("(21) 3333-4444");
  });
});
