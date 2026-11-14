import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DadosProposta } from "@/core/types-detalhe";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const COMPRA = `TESTE-PROPOSTA-${Date.now()}`;

const dados: DadosProposta = {
  orgao: "Órgão de teste",
  unidade: "Unidade de teste",
  objeto: "Objeto fictício de teste",
  numeroCompra: "1/2030",
  processo: "",
  itens: [{ numero: 1, descricao: "Item de teste", unidade: "UN", quantidade: 2, marcaModelo: "", valorUnitario: 10.5 }],
  validadeDias: 30,
  prazoEntrega: "10 dias",
  localEntrega: "",
  pagamento: "",
  garantia: "",
  observacoes: "",
  data: "2030-01-01",
};

describe.skipIf(!process.env.DATABASE_URL)("propostas no banco", () => {
  type Modulo = typeof import("./propostas");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./propostas");
    const t = await import("./empresa-teste");
    limpar = t.removerEmpresaDeTeste;
    E = await t.criarEmpresaDeTeste();
    E2 = await t.criarEmpresaDeTeste();
  }, 30_000);

  afterAll(async () => {
    await limpar(E);
    await limpar(E2);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("cria, atualiza, lista, compartilha, revoga e exclui", async () => {
    const id = await m.criarProposta(E, {
      compraId: COMPRA,
      modelo: "cotacao-simples",
      titulo: "Proposta de teste",
      dados,
      totalCentavos: 2100,
    });

    expect(await m.lerProposta(E2, id)).toBeNull();
    expect(await m.listarPropostas(E2, { compraId: COMPRA })).toEqual([]);
    expect(await m.excluirProposta(E2, id)).toBe(false);
    expect(await m.definirStatus(E2, id, "enviada")).toBe(false);
    expect(await m.gerarTokenPublico(E2, id)).toBeNull();

    const lida = await m.lerProposta(E, id);
    expect(lida?.total).toBe(21);
    expect(lida?.status).toBe("rascunho");
    expect(lida?.dados.itens[0]?.descricao).toBe("Item de teste");

    expect(await m.atualizarProposta(E, id, { titulo: "Novo título", modelo: "dispensa-produtos", dados, totalCentavos: 3150 })).not.toBeNull();
    const atualizada = await m.lerProposta(E, id);
    expect(atualizada).toMatchObject({ titulo: "Novo título", modelo: "dispensa-produtos", total: 31.5 });

    expect((await m.listarPropostas(E, { compraId: COMPRA })).map((p) => p.id)).toEqual([id]);

    expect(await m.lerPorToken("curto")).toBeNull();
    const gerado = await m.gerarTokenPublico(E, id);
    expect(gerado?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const publica = await m.lerPorToken(gerado?.token ?? "");
    expect(publica?.titulo).toBe("Novo título");
    expect(publica?.dados.orgao).toBe("Órgão de teste");

    expect(await m.definirStatus(E, id, "enviada")).toBe(true);
    expect((await m.lerProposta(E, id))?.status).toBe("enviada");

    // O status esperado protege contra duas decisões ao mesmo tempo.
    expect(await m.definirStatus(E, id, "aprovada", null, "rascunho")).toBe(false);
    expect(await m.definirStatus(E, id, "em_revisao", null, "enviada")).toBe(true);
    const emRevisao = await m.lerProposta(E, id);
    expect(emRevisao).toMatchObject({ status: "em_revisao", autor: "usuario", criadoPor: null, revisaoNota: null });
    expect(await m.definirStatus(E, id, "enviada")).toBe(true);

    expect(await m.revogarToken(E, id)).toBe(true);
    expect(await m.lerPorToken(gerado?.token ?? "")).toBeNull();

    expect(await m.excluirProposta(E, id)).toBe(true);
    expect(await m.lerProposta(E, id)).toBeNull();
    expect(await m.excluirProposta(E, id)).toBe(false);
  }, 60_000);
});
