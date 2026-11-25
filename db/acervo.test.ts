import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DadosAcervo } from "@/core/acervo";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const dados: DadosAcervo = {
  tipo: "atestado",
  titulo: "Atestado de teste",
  emissor: "Prefeitura de teste",
  emissorCnpj: null,
  descricao: "Site institucional",
  areas: ["site", "redes"],
  valor: 1234.5,
  periodoInicio: "2025-01-10",
  periodoFim: "2025-12-31",
  emitidoEm: null,
  validade: null,
};

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe.skipIf(!process.env.DATABASE_URL)("acervo no banco", () => {
  type Modulo = typeof import("./acervo");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./acervo");
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

  it("cria com arquivo, lista sem o arquivo, edita, troca e remove o arquivo", async () => {
    const id = await m.inserirNoAcervo(E, { ...dados, arquivo: { bytes: PDF, tipo: "application/pdf", nome: "atestado.pdf" } });
    const lido = await m.lerDocumentoAcervo(E, id);
    expect(lido).toMatchObject({
      titulo: "Atestado de teste",
      areas: ["site", "redes"],
      valor: 1234.5,
      periodoInicio: "2025-01-10",
      arquivoTipo: "application/pdf",
      arquivoNome: "atestado.pdf",
      arquivoTamanho: PDF.length,
    });
    expect((await m.listarAcervo(E)).map((d) => d.id)).toContain(id);

    const arquivo = await m.lerArquivoAcervo(E, id);
    expect(arquivo?.tipo).toBe("application/pdf");
    expect([...(arquivo?.bytes ?? [])]).toEqual([...PDF]);

    expect(await m.atualizarDocumentoAcervo(E, id, { ...dados, titulo: "Renomeado", areas: [], valor: null })).toBe(true);
    const editado = await m.lerDocumentoAcervo(E, id);
    expect(editado).toMatchObject({ titulo: "Renomeado", areas: [], valor: null, arquivoNome: "atestado.pdf" });

    expect(await m.atualizarDocumentoAcervo(E, id, dados, null)).toBe(true);
    expect(await m.lerArquivoAcervo(E, id)).toBeNull();
    expect((await m.lerDocumentoAcervo(E, id))?.arquivoTipo).toBeNull();

    expect(await m.excluirDocumentoAcervo(E, id)).toBe(true);
    expect(await m.lerDocumentoAcervo(E, id)).toBeNull();
  }, 60_000);

  it("não mostra nem mexe em dados de outra empresa", async () => {
    const id = await m.inserirNoAcervo(E, { ...dados, arquivo: { bytes: PDF, tipo: "application/pdf", nome: "a.pdf" } });
    expect(await m.lerDocumentoAcervo(E2, id)).toBeNull();
    expect(await m.lerArquivoAcervo(E2, id)).toBeNull();
    expect((await m.listarAcervo(E2)).some((d) => d.id === id)).toBe(false);
    expect(await m.atualizarDocumentoAcervo(E2, id, { ...dados, titulo: "Invasão" })).toBe(false);
    expect(await m.excluirDocumentoAcervo(E2, id)).toBe(false);
    expect((await m.lerDocumentoAcervo(E, id))?.titulo).toBe("Atestado de teste");
    expect(await m.lerDocumentoAcervo(E, "não-é-um-id")).toBeNull();
  }, 60_000);
});
