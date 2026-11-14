import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DadosFornecedor } from "@/core/fornecedores";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const dados: DadosFornecedor = {
  nome: "Fornecedor de teste",
  cnpj: null,
  contato: "",
  telefone: "",
  email: "",
  site: "",
  categorias: "informática",
  observacao: "",
  ativo: true,
};

describe.skipIf(!process.env.DATABASE_URL)("fornecedores no banco", () => {
  type Modulo = typeof import("./fornecedores");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./fornecedores");
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

  it("cria, edita, registra preços e sugere", async () => {
    const id = await m.criarFornecedor(E, dados);
    expect((await m.lerFornecedor(E, id))?.nome).toBe("Fornecedor de teste");
    expect(await m.atualizarFornecedor(E, id, { ...dados, nome: "Renomeado" })).toBe(true);
    expect((await m.listarFornecedores(E, "renomeado")).map((f) => f.id)).toEqual([id]);

    expect(await m.adicionarPreco(E, id, { descricao: "Monitor 24 polegadas", unidade: "un", preco: 700, prazoDias: 5, origem: "manual" })).toBe(true);
    expect(await m.adicionarPreco(E, id, { descricao: "Monitor 24 polegadas", unidade: "un", preco: 650.5, prazoDias: null, data: "2020-01-01", origem: "cotacao" })).toBe(true);
    const precos = await m.listarPrecos(E, id);
    expect(precos).toHaveLength(2);
    expect(precos[0]?.preco).toBe(700);

    const s = await m.sugerirPrecoParaDescricao(E, "MONITOR 24");
    expect(s?.menor.preco).toBe(650.5);
    expect(s?.ultimo.preco).toBe(700);
  }, 60_000);

  it("não mostra nem mexe em dados de outra empresa", async () => {
    const id = await m.criarFornecedor(E, { ...dados, nome: "Só da empresa A" });
    await m.adicionarPreco(E, id, { descricao: "Cabo de rede", unidade: "un", preco: 10, prazoDias: null, origem: "manual" });

    expect(await m.lerFornecedor(E2, id)).toBeNull();
    expect((await m.listarFornecedores(E2)).some((f) => f.id === id)).toBe(false);
    expect(await m.atualizarFornecedor(E2, id, { ...dados, nome: "Invasão" })).toBe(false);
    expect(await m.adicionarPreco(E2, id, { descricao: "Preço invasor", unidade: "un", preco: 1, prazoDias: null, origem: "manual" })).toBe(false);
    expect(await m.listarPrecos(E2, id)).toEqual([]);
    expect(await m.sugerirPrecoParaDescricao(E2, "Cabo de rede")).toBeNull();

    expect((await m.lerFornecedor(E, id))?.nome).toBe("Só da empresa A");
    expect((await m.listarPrecos(E, id)).map((p) => p.descricao)).toEqual(["Cabo de rede"]);
  }, 60_000);
});
