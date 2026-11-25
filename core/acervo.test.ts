import { describe, expect, it } from "vitest";
import {
  DadosAcervoSchema,
  LIMITE_ARQUIVO_ACERVO,
  areasEmUso,
  filtrarAcervo,
  nomeArquivoSeguro,
  normalizarArea,
  normalizarAreas,
  situacaoValidade,
  sugerirDoAcervo,
  tipoPeloConteudo,
  validarArquivoAcervo,
  type DocumentoAcervo,
} from "./acervo";

const AGORA = Date.parse("2026-11-25T15:00:00Z");

function doc(parcial: Partial<DocumentoAcervo> & { titulo: string }): DocumentoAcervo {
  return {
    id: parcial.id ?? parcial.titulo,
    tipo: "atestado",
    emissor: "",
    emissorCnpj: null,
    descricao: "",
    areas: [],
    valor: null,
    periodoInicio: null,
    periodoFim: null,
    emitidoEm: null,
    validade: null,
    arquivoTipo: null,
    arquivoNome: null,
    arquivoTamanho: null,
    atestadoId: null,
    criadoEm: "2026-11-01T00:00:00.000Z",
    ...parcial,
  };
}

describe("situacaoValidade", () => {
  it("sem validade", () => {
    expect(situacaoValidade(null, AGORA).estado).toBe("sem_validade");
  });
  it("vencida ontem", () => {
    expect(situacaoValidade("2026-11-24", AGORA)).toMatchObject({ estado: "vencida", dias: -1, rotulo: "Vencida" });
  });
  it("vence hoje, amanhã e em 10 dias", () => {
    expect(situacaoValidade("2026-11-25", AGORA).rotulo).toBe("Vence hoje");
    expect(situacaoValidade("2026-11-26", AGORA).rotulo).toBe("Vence em 1 dia");
    expect(situacaoValidade("2026-12-05", AGORA)).toMatchObject({ estado: "vencendo", dias: 10, rotulo: "Vence em 10 dias" });
  });
  it("válida depois de 30 dias", () => {
    expect(situacaoValidade("2026-12-25", AGORA).estado).toBe("vencendo");
    expect(situacaoValidade("2026-12-26", AGORA)).toMatchObject({ estado: "valida", rotulo: "Válida" });
  });
  it("usa o dia de Brasília: 02h UTC ainda é o dia anterior", () => {
    expect(situacaoValidade("2026-11-24", Date.parse("2026-11-25T02:00:00Z")).rotulo).toBe("Vence hoje");
  });
});

describe("áreas", () => {
  it("normaliza sem acento e com hífen", () => {
    expect(normalizarArea("  Redes e Cabeamento ")).toBe("redes-e-cabeamento");
    expect(normalizarArea("Manutenção")).toBe("manutencao");
  });
  it("tira vazias e repetidas", () => {
    expect(normalizarAreas(["Site", "site", " ", "SITE!"])).toEqual(["site"]);
  });
  it("lista as áreas em uso: sugeridas primeiro, livres depois", () => {
    const docs = [doc({ titulo: "a", areas: ["zeladoria", "redes"] }), doc({ titulo: "b", areas: ["site", "agua"] })];
    expect(areasEmUso(docs)).toEqual(["site", "redes", "agua", "zeladoria"]);
  });
});

describe("DadosAcervoSchema", () => {
  const base = {
    tipo: "atestado",
    titulo: " Atestado da Prefeitura ",
    emissor: "Prefeitura",
    emissorCnpj: "",
    descricao: "",
    areas: ["Site", "Redes e Cabeamento"],
    valor: 1500.5,
    periodoInicio: "2025-01-10",
    periodoFim: "2025-12-31",
    emitidoEm: "",
    validade: "",
  };
  it("aceita e normaliza", () => {
    const r = DadosAcervoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.titulo).toBe("Atestado da Prefeitura");
      expect(r.data.areas).toEqual(["site", "redes-e-cabeamento"]);
      expect(r.data.emitidoEm).toBeNull();
      expect(r.data.emissorCnpj).toBeNull();
    }
  });
  it("recusa título vazio, tipo inválido, CNPJ ruim e período invertido", () => {
    expect(DadosAcervoSchema.safeParse({ ...base, titulo: "  " }).success).toBe(false);
    expect(DadosAcervoSchema.safeParse({ ...base, tipo: "foto" }).success).toBe(false);
    expect(DadosAcervoSchema.safeParse({ ...base, emissorCnpj: "11.111.111/1111-11" }).success).toBe(false);
    expect(DadosAcervoSchema.safeParse({ ...base, periodoInicio: "2026-02-01", periodoFim: "2026-01-01" }).success).toBe(false);
    expect(DadosAcervoSchema.safeParse({ ...base, validade: "2026-02-30" }).success).toBe(false);
  });
  it("guarda só os dígitos de um CNPJ válido", () => {
    const r = DadosAcervoSchema.safeParse({ ...base, emissorCnpj: "70.048.886/0001-29" });
    expect(r.success && r.data.emissorCnpj).toBe("70048886000129");
  });
});

describe("arquivo", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  it("reconhece pelo conteúdo", () => {
    expect(tipoPeloConteudo(pdf)).toBe("application/pdf");
    expect(tipoPeloConteudo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoPeloConteudo(new Uint8Array([0x4d, 0x5a, 0x90]))).toBeNull();
  });
  it("recusa vazio, grande e tipo desconhecido", () => {
    expect(validarArquivoAcervo("a.pdf", new Uint8Array()).ok).toBe(false);
    expect(validarArquivoAcervo("a.exe", new Uint8Array([0x4d, 0x5a, 0x90])).ok).toBe(false);
    const grande = new Uint8Array(LIMITE_ARQUIVO_ACERVO + 1);
    grande.set(pdf);
    expect(validarArquivoAcervo("a.pdf", grande).ok).toBe(false);
  });
  it("aceita PDF e limpa o nome", () => {
    const r = validarArquivoAcervo('C:\\fotos\\atestado "final".exe', pdf);
    expect(r).toEqual({ ok: true, tipo: "application/pdf", nome: "atestado final.exe.pdf", tamanho: pdf.length });
    expect(nomeArquivoSeguro("../../x.PDF", "application/pdf")).toBe("x.PDF");
    expect(nomeArquivoSeguro("", "image/png")).toBe("documento.png");
  });
});

describe("filtrarAcervo", () => {
  const docs = [
    doc({ titulo: "Atestado Prefeitura de Niterói", areas: ["site"] }),
    doc({ titulo: "Nota fiscal cabos", tipo: "nota_fiscal", areas: ["redes"], emissor: "Colégio São José" }),
  ];
  it("filtra por tipo, área e busca sem acento", () => {
    expect(filtrarAcervo(docs, { tipo: "nota_fiscal", area: null, busca: "" })).toHaveLength(1);
    expect(filtrarAcervo(docs, { tipo: null, area: "site", busca: "" })[0].titulo).toContain("Niterói");
    expect(filtrarAcervo(docs, { tipo: null, area: null, busca: "colegio sao" })).toHaveLength(1);
    expect(filtrarAcervo(docs, { tipo: null, area: null, busca: "inexistente" })).toHaveLength(0);
  });
});

describe("sugerirDoAcervo", () => {
  const site = doc({ titulo: "Atestado de desenvolvimento de site", areas: ["site"], descricao: "Portal institucional da secretaria." });
  const redes = doc({ titulo: "Atestado de cabeamento estruturado", areas: ["redes"] });
  const toner = doc({ titulo: "Nota fiscal de toner", tipo: "nota_fiscal", areas: ["suprimentos"] });
  const certidaoVencida = doc({ titulo: "Certidão de site", tipo: "certidao", areas: ["site"], validade: "2026-01-01" });
  const generico = doc({ titulo: "Atestado de capacidade técnica", areas: [] });

  it("acha pelo objeto e explica o motivo", () => {
    const r = sugerirDoAcervo("Contratação de empresa para criação de site institucional", [redes, toner, site], 5, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].documento.id).toBe(site.id);
    expect(r[0].motivo).toMatch(/^Bate com: site institucional/);
  });
  it("ignora certidão vencida e documento genérico", () => {
    const r = sugerirDoAcervo("Desenvolvimento de site para o município", [certidaoVencida, generico], 5, AGORA);
    expect(r).toEqual([]);
  });
  it("mantém certidão dentro da validade", () => {
    const valida = { ...certidaoVencida, id: "v", validade: "2027-06-01" };
    expect(sugerirDoAcervo("Desenvolvimento de site", [valida], 5, AGORA)).toHaveLength(1);
  });
  it("área livre também casa", () => {
    const d = doc({ titulo: "Atestado de zeladoria", areas: ["jardinagem"] });
    expect(sugerirDoAcervo("Serviços de jardinagem em praças", [d], 5, AGORA)[0].motivo).toContain("jardinagem");
  });
  it("respeita o máximo e ordena por pontos", () => {
    const muitos = Array.from({ length: 8 }, (_, i) => doc({ titulo: `Atestado cabos ${i}`, areas: ["redes"] }));
    const r = sugerirDoAcervo("Cabeamento estruturado de rede", [...muitos, site], 3, AGORA);
    expect(r).toHaveLength(3);
    expect(sugerirDoAcervo("", muitos, 3, AGORA)).toEqual([]);
  });
});
