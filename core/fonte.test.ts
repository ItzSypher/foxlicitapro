import { describe, expect, it } from "vitest";
import { fonteDaOportunidade } from "./fonte";

describe("fonteDaOportunidade", () => {
  it.each([
    ["https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=1", "Compras.gov"],
    ["https://www.gov.br/compras/pt-br", "Outro portal"],
    ["https://compras.rj.gov.br/Portal-Siga/Principal.aspx", "Compras RJ"],
    ["https://bnccompras.com/Process/ProcessView?param1=1", "BNC"],
    ["https://bllcompras.com/Process/ProcessView?param1=1", "BLL"],
    ["https://www.licitanet.com.br/compras/1", "Licitanet"],
    ["https://www.portaldecompraspublicas.com.br/18/", "Portal de Compras Públicas"],
    ["https://exemplo.gov.br/edital", "Outro portal"],
  ] as const)("%s vira %s", (link, fonte) => {
    expect(fonteDaOportunidade(link)).toBe(fonte);
  });

  it("sem link ou link inválido vira Outro portal", () => {
    expect(fonteDaOportunidade(null)).toBe("Outro portal");
    expect(fonteDaOportunidade(undefined)).toBe("Outro portal");
    expect(fonteDaOportunidade("  ")).toBe("Outro portal");
    expect(fonteDaOportunidade("não é link")).toBe("Outro portal");
  });

  it("aceita domínio sem protocolo e caixa alta", () => {
    expect(fonteDaOportunidade("BNCCOMPRAS.com/x")).toBe("BNC");
  });
});
