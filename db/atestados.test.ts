import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DadosAtestadoSchema } from "@/core/atestados";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const dados = DadosAtestadoSchema.parse({
  clienteNome: "Prefeitura de teste",
  clienteCnpj: "70.048.886/0001-29",
  clienteEndereco: "",
  responsavelNome: "Maria",
  responsavelCargo: "Secretária",
  responsavelContato: "",
  objeto: "Site institucional e manutenção",
  areas: ["site", "manutencao"],
  periodoInicio: "2026-01-10",
  periodoFim: "2026-06-30",
  valor: "12.500,00",
  texto: "Atestamos, para os devidos fins, que a empresa de teste prestou os serviços.",
});

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PDF = Buffer.from("%PDF-1.4 teste");

describe.skipIf(!process.env.DATABASE_URL)("atestados no banco", () => {
  type Modulo = typeof import("./atestados");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./atestados");
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

  it("segue rascunho, aguardando e assinado, guarda no acervo e confere pelo código", async () => {
    const id = await m.criarAtestado(E, null, dados);
    expect((await m.lerAtestado(E, id))?.status).toBe("rascunho");
    expect(await m.lerAtestado(E2, id)).toBeNull();

    const link = await m.gerarLink(E, id);
    expect(link?.token).toHaveLength(43);
    expect((await m.gerarLink(E, id))?.token).toBe(link?.token);
    expect((await m.gerarLink(E, id, true))?.token).not.toBe(link?.token);
    const token = (await m.gerarLink(E, id))?.token ?? "";

    const publico = await m.lerPorToken(token);
    expect(publico).toMatchObject({ status: "aguardando", expirado: false, clienteNome: "Prefeitura de teste" });

    const assinatura = { nome: "Maria Souza", cargo: "Secretária", documento: null, assinatura: PNG, declaracao: true as const };
    const r = await m.assinar(token, assinatura, { ip: "203.0.113.9", agente: "Teste" });
    expect(r.ok).toBe(true);
    const codigo = r.ok ? r.codigo : "";
    expect(codigo).toHaveLength(8);
    expect(await m.assinar(token, assinatura, { ip: "x", agente: "y" })).toEqual({ ok: false, motivo: "ja-assinado" });
    expect(await m.atualizarAtestado(E, id, dados)).toBe(false);

    const lido = await m.lerAtestado(E, id);
    expect(lido).toMatchObject({ status: "assinado", codigo, assinanteNome: "Maria Souza", assinaturaIp: "203.0.113.9" });
    expect(lido?.conteudoHash).toMatch(/^[0-9a-f]{64}$/);

    const verificacao = await m.lerPorCodigo(codigo.toLowerCase());
    expect(verificacao).toMatchObject({ clienteNome: "Prefeitura de teste", integro: true, hash: lido?.conteudoHash });

    const { sql } = await import("./client");
    const acervo = await sql<Array<{ tipo: string; titulo: string; emissor: string; valor: string; atestado_id: string }>>`
      select tipo, titulo, emissor, valor, atestado_id from acervo_documentos where empresa_id = ${E}
    `;
    expect(acervo).toHaveLength(1);
    expect(acervo[0]).toMatchObject({ tipo: "atestado", titulo: "Atestado — Prefeitura de teste", emissor: "Prefeitura de teste", atestado_id: id });

    expect(await m.anexarArquivoAssinado(E, id, PDF)).toEqual({ ok: true });
    const comArquivo = await sql<Array<{ arquivo_tipo: string | null; arquivo_tamanho: number | null }>>`
      select arquivo_tipo, arquivo_tamanho from acervo_documentos where empresa_id = ${E}
    `;
    expect(comArquivo).toHaveLength(1);
    expect(comArquivo[0]).toMatchObject({ arquivo_tipo: "application/pdf", arquivo_tamanho: PDF.length });
  }, 30_000);

  it("cancelado não assina e editar um aguardando derruba o link", async () => {
    const id = await m.criarAtestado(E, null, dados);
    const token = (await m.gerarLink(E, id))?.token ?? "";
    expect(await m.atualizarAtestado(E, id, dados)).toBe(true);
    expect(await m.lerPorToken(token)).toBeNull();

    const novo = (await m.gerarLink(E, id))?.token ?? "";
    expect(await m.cancelarAtestado(E, id)).toBe(true);
    const r = await m.assinar(novo, { nome: "Maria Souza", cargo: "Secretária", documento: null, assinatura: PNG, declaracao: true }, { ip: "x", agente: "y" });
    expect(r).toEqual({ ok: false, motivo: "indisponivel" });
    expect(await m.gerarLink(E, id)).toBeNull();
  }, 30_000);

  it("rejeita arquivo que não é PDF ou passa de 4 MB", async () => {
    const id = await m.criarAtestado(E, null, dados);
    expect(await m.anexarArquivoAssinado(E, id, Buffer.from("texto qualquer"))).toEqual({ ok: false, motivo: "formato" });
    expect(await m.anexarArquivoAssinado(E, id, Buffer.alloc(4 * 1024 * 1024 + 1))).toEqual({ ok: false, motivo: "grande" });
    expect(await m.anexarArquivoAssinado(E2, id, PDF)).toEqual({ ok: false, motivo: "nao-encontrado" });
  }, 30_000);
});
