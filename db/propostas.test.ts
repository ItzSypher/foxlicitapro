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
  const criadas: string[] = [];

  beforeAll(async () => {
    m = await import("./propostas");
  }, 30_000);

  afterAll(async () => {
    for (const id of criadas) await m.excluirProposta(id);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("cria, atualiza, lista, compartilha, revoga e exclui", async () => {
    const id = await m.criarProposta({
      compraId: COMPRA,
      modelo: "cotacao-simples",
      titulo: "Proposta de teste",
      dados,
      totalCentavos: 2100,
    });
    criadas.push(id);

    const lida = await m.lerProposta(id);
    expect(lida?.total).toBe(21);
    expect(lida?.status).toBe("rascunho");
    expect(lida?.dados.itens[0]?.descricao).toBe("Item de teste");

    expect(await m.atualizarProposta(id, { titulo: "Novo título", modelo: "dispensa-produtos", dados, totalCentavos: 3150 })).not.toBeNull();
    const atualizada = await m.lerProposta(id);
    expect(atualizada).toMatchObject({ titulo: "Novo título", modelo: "dispensa-produtos", total: 31.5 });

    expect((await m.listarPropostas({ compraId: COMPRA })).map((p) => p.id)).toEqual([id]);

    expect(await m.lerPorToken("curto")).toBeNull();
    const gerado = await m.gerarTokenPublico(id);
    expect(gerado?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const publica = await m.lerPorToken(gerado?.token ?? "");
    expect(publica?.titulo).toBe("Novo título");
    expect(publica?.dados.orgao).toBe("Órgão de teste");

    expect(await m.definirStatus(id, "enviada")).toBe(true);
    expect((await m.lerProposta(id))?.status).toBe("enviada");

    // O status esperado protege contra duas decisões ao mesmo tempo.
    expect(await m.definirStatus(id, "aprovada", null, "rascunho")).toBe(false);
    expect(await m.definirStatus(id, "em_revisao", null, "enviada")).toBe(true);
    const emRevisao = await m.lerProposta(id);
    expect(emRevisao).toMatchObject({ status: "em_revisao", autor: "usuario", criadoPor: null, revisaoNota: null });
    expect(await m.definirStatus(id, "enviada")).toBe(true);

    expect(await m.revogarToken(id)).toBe(true);
    expect(await m.lerPorToken(gerado?.token ?? "")).toBeNull();

    expect(await m.excluirProposta(id)).toBe(true);
    expect(await m.lerProposta(id)).toBeNull();
    expect(await m.excluirProposta(id)).toBe(false);
  }, 60_000);
});
