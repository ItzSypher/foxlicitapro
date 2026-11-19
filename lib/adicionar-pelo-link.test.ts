import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalheCompra } from "@/core/types-detalhe";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  buscarDetalheCompra: vi.fn(),
  lerEtapaItem: vi.fn(),
  salvarItem: vi.fn(),
  lerPreferencias: vi.fn(),
  perfilDaEmpresa: vi.fn(),
}));

vi.mock("@/core/pncp/detalhe", () => ({ buscarDetalheCompra: m.buscarDetalheCompra }));
vi.mock("@/db/pipeline", () => ({ lerEtapaItem: m.lerEtapaItem, salvarItem: m.salvarItem }));
vi.mock("@/db/preferencias", () => ({ lerPreferencias: m.lerPreferencias }));
vi.mock("@/lib/empresa-atual", () => ({ perfilDaEmpresa: m.perfilDaEmpresa }));

import { ROTULO_ETAPA } from "@/components/pipeline/tipos";
import { PERFIL_ORIGEM } from "@/core/empresa";
import { ErroPncp } from "@/core/pncp/client";
import { adicionarPeloLink, adicionarPelosLinks } from "./adicionar-pelo-link";

const LINK = "https://pncp.gov.br/app/editais/12345678000199/2025/123";

function detalhe(sobra: Partial<DetalheCompra> = {}): DetalheCompra {
  return {
    chave: { cnpj: "12345678000199", ano: 2025, sequencial: 123 },
    numeroControle: "12345678000199-1-000123/2025",
    numeroCompra: "10/2025",
    processo: null,
    objeto: "Aquisição de material de escritório",
    informacaoComplementar: null,
    modalidadeId: 6,
    modalidadeNome: "Pregão - Eletrônico",
    modoDisputa: null,
    amparoLegal: null,
    situacao: null,
    srp: false,
    orgao: "Prefeitura",
    orgaoCnpj: "12345678000199",
    unidade: "Secretaria",
    municipio: "Nova Iguaçu",
    uf: "RJ",
    codigoIbge: "3303500",
    valorEstimado: 20_000,
    valorHomologado: null,
    dataInclusao: null,
    dataPublicacao: null,
    dataAbertura: null,
    dataEncerramento: "2030-01-01T15:00:00-03:00",
    dataAtualizacao: null,
    linkPncp: LINK,
    linkOrigem: null,
    linkProcesso: null,
    itens: [],
    totalItens: 0,
    arquivos: [],
    falhas: [],
    ...sobra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  m.buscarDetalheCompra.mockResolvedValue(detalhe());
  m.lerEtapaItem.mockResolvedValue(null);
  m.salvarItem.mockResolvedValue({ criado: true });
  m.lerPreferencias.mockResolvedValue({ capitalMaximo: null, diasMaximosParado: null });
  m.perfilDaEmpresa.mockResolvedValue(PERFIL_ORIGEM);
});

describe("adicionarPeloLink", () => {
  it("busca no PNCP, calcula a nota e salva na etapa Radar", async () => {
    const r = await adicionarPeloLink("emp1", "u1", LINK);
    expect(r).toEqual({
      ok: true,
      jaEstava: false,
      titulo: "Aquisição de material de escritório",
      etapa: "radar",
      rotuloEtapa: ROTULO_ETAPA.radar,
      href: "/licitacao/12345678000199/2025/123",
    });
    expect(m.buscarDetalheCompra).toHaveBeenCalledWith({ cnpj: "12345678000199", ano: 2025, sequencial: 123 });
    const [empresa, oportunidade, usuario] = m.salvarItem.mock.calls[0] ?? [];
    expect(empresa).toBe("emp1");
    expect(usuario).toBe("u1");
    expect(oportunidade).toMatchObject({ id: "12345678000199-1-000123/2025", modalidadeId: 6 });
    expect(oportunidade.score.total).toBeTypeOf("number");
  });

  it("já no Pipeline: devolve já estava, com a etapa atual, e não salva de novo", async () => {
    m.lerEtapaItem.mockResolvedValue("cotando");
    const r = await adicionarPeloLink("emp1", "u1", LINK);
    expect(r).toMatchObject({ ok: true, jaEstava: true, etapa: "cotando", rotuloEtapa: ROTULO_ETAPA.cotando });
    expect(m.salvarItem).not.toHaveBeenCalled();
  });

  it("texto sem link reconhecido", async () => {
    const r = await adicionarPeloLink("emp1", "u1", "qualquer coisa");
    expect(r).toMatchObject({ ok: false });
    expect(m.buscarDetalheCompra).not.toHaveBeenCalled();
  });

  it("contratação inexistente, modalidade fora de 6/8 e sem prazo viram erro claro", async () => {
    m.buscarDetalheCompra.mockResolvedValueOnce(null);
    expect(await adicionarPeloLink("emp1", "u1", LINK)).toEqual({ ok: false, erro: "Não achei essa contratação no PNCP." });

    m.buscarDetalheCompra.mockResolvedValueOnce(detalhe({ modalidadeId: 4, modalidadeNome: "Concorrência" }));
    const r = await adicionarPeloLink("emp1", "u1", LINK);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.erro).toContain("Concorrência");

    m.buscarDetalheCompra.mockResolvedValueOnce(detalhe({ dataEncerramento: null }));
    expect(await adicionarPeloLink("emp1", "u1", LINK)).toMatchObject({ ok: false });
    expect(m.salvarItem).not.toHaveBeenCalled();
  });

  it("falha do PNCP ou do banco não lança", async () => {
    m.buscarDetalheCompra.mockRejectedValueOnce(new ErroPncp("fora do ar"));
    const r1 = await adicionarPeloLink("emp1", "u1", LINK);
    expect(r1.ok ? "" : r1.erro).toContain("PNCP");
    m.salvarItem.mockRejectedValueOnce(new Error("banco"));
    expect(await adicionarPeloLink("emp1", "u1", LINK)).toMatchObject({ ok: false });
  });
});

describe("adicionarPelosLinks", () => {
  it("uma linha por link; linha inválida vira erro e repetido conta uma vez", async () => {
    const texto = [LINK, "abc", `${LINK}/`, "12345678000199-1-000007/2024"].join("\n");
    const r = await adicionarPelosLinks("emp1", "u1", texto);
    expect(r.map((x) => x.ok)).toEqual([true, false, true]);
    expect(r[1]?.entrada).toBe("abc");
    expect(m.buscarDetalheCompra).toHaveBeenCalledTimes(2);
  });
});
