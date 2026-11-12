import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Faixa, OportunidadeComScore } from "@/core/types";

vi.mock("server-only", () => ({}));

type Modulo = typeof import("./resumo-diario");
let m: Modulo;

beforeAll(async () => {
  m = await import("./resumo-diario");
});

const AGORA = new Date("2026-11-12T10:00:00.000Z");
const HORA = 3_600_000;

function oport(
  id: string,
  objeto: string,
  opcoes: { horas?: number; nota?: number; faixa?: Faixa; valor?: number | null } = {},
): OportunidadeComScore {
  const nota = opcoes.nota ?? 80;
  return {
    id,
    objeto,
    valorEstimado: opcoes.valor === undefined ? 12000 : opcoes.valor,
    orgao: "Prefeitura de Teste",
    orgaoCnpj: "12345678000190",
    unidade: "",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "nova-iguacu",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: new Date(AGORA.getTime() + (opcoes.horas ?? 100) * HORA).toISOString(),
    anoCompra: 2026,
    sequencialCompra: Number(id.replace(/\D/g, "")) || 1,
    linkPncp: "",
    linkOrigem: null,
    score: {
      total: nota,
      faixa: opcoes.faixa ?? (nota >= 75 ? "go" : nota >= 50 ? "atencao" : "nogo"),
      criterios: [],
      cnaesCasados: [],
      frenteCasada: "servicos",
    },
  };
}

const PREFS = {
  termosPrioritarios: ["sistema", "software", "suporte tecnico", "cadeira"],
  termosBloqueadosParaVoce: ["cftv", "camera"],
};

function resumir(
  servicos: OportunidadeComScore[],
  idsAnteriores: ReadonlySet<string> | null = null,
  produtos: OportunidadeComScore[] = [],
) {
  return m.montarResumoDeDados({ agora: AGORA, servicos, produtos, preferencias: PREFS, propostas: [], idsAnteriores });
}

describe("seleção de software", () => {
  it("usa só os termos prioritários de software ou TI", () => {
    expect(m.termosDeSoftware(["Sistema", "cadeira", "Suporte técnico"])).toEqual(["sistema", "suporte tecnico"]);
    expect(m.termosDeSoftware(["cadeira"])).toEqual(["sistema", "software"]);
  });

  it("escolhe objetos de software e ignora o resto, por nota", () => {
    const lista = [
      oport("a1", "Licença de software de gestão pública", { nota: 70 }),
      oport("a2", "Aquisição de cadeiras de escritório", { nota: 95 }),
      oport("a3", "Contratação de sistema de gestão escolar", { nota: 90 }),
    ];
    const r = resumir(lista);
    expect(r.software.map((l) => l.id)).toEqual(["a3", "a1"]);
    expect(r.totalSoftware).toBe(2);
  });

  it("não trata sistema de registro de preços nem setor de sistemas como software", () => {
    const lista = [
      oport("b1", "Sistema de registro de preços para material de limpeza"),
      oport("b2", "Material para a Diretoria de Sistemas de Informação"),
    ];
    expect(resumir(lista).software).toHaveLength(0);
  });

  it("ignora as encerradas e limita a 8", () => {
    const lista = [
      oport("c0", "Software antigo", { horas: -2 }),
      ...Array.from({ length: 10 }, (_, i) => oport(`c${i + 1}`, "Sistema de gestão", { nota: 60 + i })),
    ];
    const r = resumir(lista);
    expect(r.software).toHaveLength(8);
    expect(r.totalSoftware).toBe(10);
    expect(r.software[0]?.id).toBe("c10");
  });

  it("junta as duas frentes sem repetir e fica com a maior nota", () => {
    const r = resumir([oport("d1", "Sistema de gestão", { nota: 60 })], null, [oport("d1", "Sistema de gestão", { nota: 85 })]);
    expect(r.software).toHaveLength(1);
    expect(r.software[0]?.nota).toBe(85);
  });
});

describe("exclusão de bloqueados", () => {
  it("tira o software que contém termo bloqueado, de todas as seções", () => {
    const lista = [
      oport("e1", "Sistema de monitoramento por câmeras", { horas: 20 }),
      oport("e2", "Sistema de CFTV", { horas: 20 }),
      oport("e3", "Sistema de gestão", { horas: 20 }),
    ];
    const r = resumir(lista);
    expect(r.software.map((l) => l.id)).toEqual(["e3"]);
    expect(r.fecham.map((l) => l.id)).toEqual(["e3"]);
    expect(r.ids).not.toContain("e1");
  });
});

describe("marcação de nova", () => {
  it("marca só as que não estavam no envio anterior", () => {
    const lista = [oport("f1", "Sistema de gestão"), oport("f2", "Software de ponto")];
    const r = resumir(lista, new Set(["f1"]));
    expect(r.software.find((l) => l.id === "f1")?.nova).toBe(false);
    expect(r.software.find((l) => l.id === "f2")?.nova).toBe(true);
  });

  it("no primeiro envio ninguém é marcada", () => {
    const r = resumir([oport("g1", "Sistema de gestão")], null);
    expect(r.software[0]?.nova).toBe(false);
  });
});

describe("fecham em 48 h", () => {
  it("só traz software/TI e sugestões, ordena por prazo e respeita o limite de 5", () => {
    const lista = [
      oport("h1", "Sistema de gestão", { horas: 40, nota: 60 }),
      oport("h2", "Cadeiras de escritório", { horas: 10, nota: 90 }),
      oport("h4", "Sistema de ponto", { horas: 60, nota: 90 }),
      ...Array.from({ length: 6 }, (_, i) => oport(`s${i + 1}`, "Licença de software antivírus", { horas: 20 + i, nota: 70 })),
    ];
    const r = resumir(lista);
    const ids = r.fecham.map((l) => l.id);
    expect(r.fecham.length).toBeLessThanOrEqual(5);
    expect(ids).not.toContain("h4");
    expect(r.fecham.every((l) => l.encerraEm - AGORA.getTime() <= 48 * HORA)).toBe(true);
    const prazos = r.fecham.map((l) => l.encerraEm);
    expect([...prazos].sort((a, b) => a - b)).toEqual(prazos);
  });
});

describe("linha e assunto", () => {
  it("monta valor, prazo, faixa e link absoluto", () => {
    const r = resumir([
      oport("j7", "Contratação de empresa para fornecimento de sistema de gestão", { horas: 50, nota: 82 }),
    ]);
    const l = r.software[0];
    expect(l?.valor.replace(/\s/g, " ")).toBe("R$ 12.000");
    expect(l?.prazo).toBe("fecha em 2 d");
    expect(l?.palavraFaixa).toBe("boa");
    expect(l?.link).toBe("https://licitapro.foxtisolutions.com.br/licitacao/12345678000190/2026/7");
    expect(l?.objeto.startsWith("Contratação")).toBe(false);
  });

  it("mostra Sigiloso sem valor", () => {
    const r = resumir([oport("k1", "Sistema de gestão", { valor: null })]);
    expect(r.software[0]?.valor).toBe("Sigiloso");
  });

  it("calcula o assunto", () => {
    expect(m.montarAssunto(5, 3)).toBe("Radar de hoje: 5 de software, 3 fecham em 48 h");
    expect(m.montarAssunto(2, 1)).toBe("Radar de hoje: 2 de software, 1 fecha em 48 h");
    expect(m.montarAssunto(4, 0)).toBe("Radar de hoje: 4 de software");
    expect(m.montarAssunto(0, 0)).toBe("Radar de hoje: nada novo de software");
    expect(m.montarAssunto(0, 2)).toBe("Radar de hoje: nada novo de software, 2 fecham em 48 h");
  });
});

describe("propostas esperando", () => {
  it("conta em revisão e devolvidas", () => {
    const r = m.montarResumoDeDados({
      agora: AGORA,
      servicos: [],
      produtos: [],
      preferencias: PREFS,
      propostas: [
        { titulo: "Proposta A", status: "em_revisao" },
        { titulo: "Proposta B", status: "devolvida" },
        { titulo: "Proposta C", status: "devolvida" },
      ],
      idsAnteriores: null,
    });
    expect(r.propostas).toMatchObject({ total: 3, emRevisao: 1, devolvidas: 2 });
  });
});

describe("texto puro e HTML", () => {
  let r: import("./resumo-diario").Resumo;
  beforeAll(() => {
    r = resumir([oport("l1", "Sistema de gestão <b>", { horas: 20 })], new Set());
  });

  it("o texto não tem HTML, tem o link e o botão", () => {
    const t = m.renderizarResumoTexto(r);
    expect(t).not.toMatch(/<(?:table|tr|td|a|div|span)\b/);
    expect(t).toContain("https://licitapro.foxtisolutions.com.br/licitacao/12345678000190/2026/1");
    expect(t).toContain("[Nova]");
    expect(t).toContain("Abrir o Radar:");
  });

  it("o HTML escapa o conteúdo, usa largura 600 e laranja só no botão", () => {
    const h = m.renderizarResumoHtml(r);
    expect(h).toContain("&lt;b&gt;");
    expect(h).not.toContain("<b>");
    expect(h).toContain('width="600"');
    expect(h).toContain("raposa.svg");
    expect(h.match(/#F57E11/gi)?.length).toBe(1);
  });

  it("sem software, mostra a versão curta com as sugestões", () => {
    const vazio = resumir([oport("m1", "Cadeiras de escritório", { nota: 80, horas: 200 })]);
    expect(vazio.software).toHaveLength(0);
    expect(m.renderizarResumoTexto(vazio)).toContain("Nada novo de software hoje.");
    expect(m.renderizarResumoHtml(vazio)).toContain("Nada novo de software hoje.");
  });

  it("não cita IA", () => {
    const completo = m.renderizarResumoHtml(r) + m.renderizarResumoTexto(r);
    expect(completo).not.toMatch(/\b(?:IA|Claude|Gemini|assistente)\b/i);
  });
});
