import { describe, expect, it } from "vitest";
import { cookieEmpresaRelevante, decidirEmpresaAtiva, ehIdEmpresa, papelNaEmpresa } from "./empresa-ativa";

const PROPRIA = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const TERCEIRA = "33333333-3333-4333-8333-333333333333";

describe("decidirEmpresaAtiva", () => {
  it("sem cookie, vale a empresa própria", () => {
    expect(decidirEmpresaAtiva(undefined, PROPRIA, [OUTRA])).toEqual({ empresaId: PROPRIA, propria: true });
  });

  it("cookie de empresa acessada troca a empresa", () => {
    expect(decidirEmpresaAtiva(OUTRA, PROPRIA, [OUTRA, TERCEIRA])).toEqual({ empresaId: OUTRA, propria: false });
  });

  it("cookie de empresa sem acesso volta para a própria", () => {
    expect(decidirEmpresaAtiva(TERCEIRA, PROPRIA, [OUTRA])).toEqual({ empresaId: PROPRIA, propria: true });
  });

  it("cookie com a própria empresa continua na própria", () => {
    expect(decidirEmpresaAtiva(PROPRIA, PROPRIA, [OUTRA])).toEqual({ empresaId: PROPRIA, propria: true });
  });

  it("cookie malformado é ignorado", () => {
    expect(decidirEmpresaAtiva("qualquer-coisa", PROPRIA, [OUTRA])).toEqual({ empresaId: PROPRIA, propria: true });
    expect(decidirEmpresaAtiva("", PROPRIA, [OUTRA])).toEqual({ empresaId: PROPRIA, propria: true });
  });

  it("compara ids sem diferenciar maiúsculas e devolve o id da lista de acessos", () => {
    expect(decidirEmpresaAtiva(OUTRA.toUpperCase(), PROPRIA, [OUTRA])).toEqual({ empresaId: OUTRA, propria: false });
  });

  it("sem acessos extras (empresa desativada, acesso removido), cai na própria", () => {
    expect(decidirEmpresaAtiva(OUTRA, PROPRIA, [])).toEqual({ empresaId: PROPRIA, propria: true });
  });
});

describe("cookieEmpresaRelevante", () => {
  it("só devolve ids válidos diferentes da própria", () => {
    expect(cookieEmpresaRelevante(OUTRA, PROPRIA)).toBe(OUTRA);
    expect(cookieEmpresaRelevante(PROPRIA, PROPRIA)).toBeNull();
    expect(cookieEmpresaRelevante("x", PROPRIA)).toBeNull();
    expect(cookieEmpresaRelevante(undefined, PROPRIA)).toBeNull();
  });
});

describe("papelNaEmpresa", () => {
  it("na própria mantém o papel; nas outras é gestor", () => {
    expect(papelNaEmpresa("dono", true)).toBe("dono");
    expect(papelNaEmpresa("juridico", true)).toBe("juridico");
    expect(papelNaEmpresa("dono", false)).toBe("gestor");
    expect(papelNaEmpresa("juridico", false)).toBe("gestor");
  });
});

describe("ehIdEmpresa", () => {
  it("reconhece UUID", () => {
    expect(ehIdEmpresa(PROPRIA)).toBe(true);
    expect(ehIdEmpresa("abc")).toBe(false);
    expect(ehIdEmpresa(null)).toBe(false);
  });
});
