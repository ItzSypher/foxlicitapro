import { describe, expect, it } from "vitest";
import {
  avisoItemAtribuido,
  avisoPropostaRevisada,
  avisosDeDisputa,
  avisosDeFicha,
  avisosDeOportunidade,
  avisosDePropostaParada,
  destinatariosDoAviso,
  diaDeSaoPaulo,
  planejarEntregas,
  type AvisoNovo,
  type PessoaAviso,
} from "./avisos";
import { FICHA_EXEMPLO } from "./ficha.fixture";
import type { OportunidadeComScore } from "./types";

const AGORA = new Date("2026-11-12T10:00:00.000Z");
const H = 3_600_000;
const em = (horas: number) => new Date(AGORA.getTime() + horas * H).toISOString();

function oport(id: string, nota: number, horas = 100): OportunidadeComScore {
  return {
    id,
    objeto: "Contratação de sistema de gestão",
    valorEstimado: 50000,
    orgao: "Prefeitura",
    orgaoCnpj: "12345678000190",
    unidade: "",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "nova-iguacu",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: em(horas),
    anoCompra: 2026,
    sequencialCompra: 7,
    linkPncp: "",
    linkOrigem: null,
    score: { total: nota, faixa: "go", criterios: [], cnaesCasados: [], frenteCasada: "servicos" },
  };
}

function pessoa(id: string, extra: Partial<PessoaAviso> = {}): PessoaAviso {
  return { id, nome: id, email: `${id}@x.invalid`, papel: "gestor", permissoes: [], whatsapp: null, avisoEmail: true, avisoWhatsapp: false, ...extra };
}

describe("avisosDeDisputa", () => {
  const base = { objeto: "Sistema de gestão", responsavelId: null };
  it("avisa só o que fecha em até 48 h e ainda está em jogo", () => {
    const avisos = avisosDeDisputa(
      [
        { ...base, id: "a", etapa: "proposta", dataEncerramento: em(5) },
        { ...base, id: "b", etapa: "proposta", dataEncerramento: em(60) },
        { ...base, id: "c", etapa: "ganha", dataEncerramento: em(5) },
        { ...base, id: "d", etapa: "cotando", dataEncerramento: em(-2) },
        { ...base, id: "e", etapa: "disputa", dataEncerramento: em(47), responsavelId: "u1" },
      ],
      AGORA,
    );
    expect(avisos.map((a) => a.chave)).toEqual(["disputa:a", "disputa:e"]);
    expect(avisos[0]?.titulo).toBe("Disputa em 5 h");
    expect(avisos[0]?.alvo).toEqual({ tipo: "todos" });
    expect(avisos[1]?.alvo).toEqual({ tipo: "pessoa", usuarioId: "u1" });
  });
});

describe("avisosDeOportunidade", () => {
  it("só nota alta, aberta e fora do pipeline, sem repetir", () => {
    const avisos = avisosDeOportunidade(
      [oport("a", 85), oport("a", 90), oport("b", 70), oport("c", 95), oport("d", 88, -1)],
      new Set(["c"]),
      AGORA,
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.chave).toBe("oportunidade:a");
    expect(avisos[0]?.titulo).toContain("nota 85");
    expect(avisos[0]?.link).toBe("/licitacao/12345678000190/2026/7");
  });
});

describe("avisosDeFicha", () => {
  const semMensal = { ...FICHA_EXEMPLO, medicaoMensal: { ...FICHA_EXEMPLO.medicaoMensal, valor: false } };
  const item = { id: "i1", etapa: "analisando", objeto: "Sistema", responsavelId: null };

  it("receita mensal com ficha conferida vira aviso", () => {
    const [aviso] = avisosDeFicha([{ ...item, valorEstimado: 120000, ficha: FICHA_EXEMPLO }], { capitalMaximo: null, diasMaximosParado: null }, AGORA);
    expect(aviso?.titulo).toBe("Receita mensal com ficha conferida");
  });

  it("receita mensal e capital baixo juntos", () => {
    const [aviso] = avisosDeFicha([{ ...item, valorEstimado: 120000, ficha: FICHA_EXEMPLO }], { capitalMaximo: 50000, diasMaximosParado: null }, AGORA);
    expect(aviso?.titulo).toBe("Receita mensal e pouco capital de giro");
  });

  it("capital baixo sem receita mensal", () => {
    const [aviso] = avisosDeFicha([{ ...item, valorEstimado: 10000, ficha: semMensal }], { capitalMaximo: 50000, diasMaximosParado: null }, AGORA);
    expect(aviso?.titulo).toBe("Pouco capital de giro com ficha conferida");
  });

  it("capital alto, sem limite definido ou item encerrado não avisam", () => {
    expect(avisosDeFicha([{ ...item, valorEstimado: 100000, ficha: semMensal }], { capitalMaximo: 50000, diasMaximosParado: null }, AGORA)).toEqual([]);
    expect(avisosDeFicha([{ ...item, valorEstimado: 10000, ficha: semMensal }], { capitalMaximo: null, diasMaximosParado: null }, AGORA)).toEqual([]);
    expect(
      avisosDeFicha([{ ...item, etapa: "perdida", valorEstimado: 120000, ficha: FICHA_EXEMPLO }], { capitalMaximo: null, diasMaximosParado: null }, AGORA),
    ).toEqual([]);
  });
});

describe("avisosDePropostaParada", () => {
  it("avisa quem aprova quando a revisão passa de 24 h, menos a autora", () => {
    const avisos = avisosDePropostaParada(
      [
        { id: "p1", titulo: "Proposta A", status: "em_revisao", atualizadoEm: em(-30), criadoPor: "u1" },
        { id: "p2", titulo: "Proposta B", status: "em_revisao", atualizadoEm: em(-10), criadoPor: "u1" },
        { id: "p3", titulo: "Proposta C", status: "devolvida", atualizadoEm: em(-50), criadoPor: "u1" },
      ],
      AGORA,
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ alvo: { tipo: "permissao", permissao: "aprovar_propostas" }, exceto: "u1", link: "/propostas/p1" });
    expect(avisos[0]?.titulo).toBe("Proposta parada há 1 d 6 h na revisão");
  });
});

describe("eventos", () => {
  it("revisão: a própria autora não é avisada; devolvida leva a nota", () => {
    const base = { id: "p", titulo: "T", revisorNome: "Ana", nota: "Ajustar prazo", em: AGORA };
    expect(avisoPropostaRevisada({ ...base, autorId: "u1", revisorId: "u1", aprovada: true })).toBeNull();
    expect(avisoPropostaRevisada({ ...base, autorId: null, revisorId: "u1", aprovada: true })).toBeNull();
    const devolvida = avisoPropostaRevisada({ ...base, autorId: "u2", revisorId: "u1", aprovada: false });
    expect(devolvida?.titulo).toBe("Proposta devolvida");
    expect(devolvida?.corpo).toContain("Ajustar prazo");
  });

  it("atribuir a si mesmo não avisa", () => {
    expect(avisoItemAtribuido({ itemId: "i", objeto: "x", responsavelId: "u1", porId: "u1", porNome: "A", em: AGORA })).toBeNull();
    expect(avisoItemAtribuido({ itemId: "i", objeto: "x", responsavelId: "u2", porId: "u1", porNome: "A", em: AGORA })?.alvo).toEqual({
      tipo: "pessoa",
      usuarioId: "u2",
    });
  });
});

describe("destinatários", () => {
  const pessoas = [pessoa("dono", { papel: "dono" }), pessoa("g1", { permissoes: ["aprovar_propostas"] }), pessoa("g2")];
  it("por permissão inclui o dono e respeita a exceção", () => {
    const aviso = { alvo: { tipo: "permissao", permissao: "aprovar_propostas" }, exceto: "g1" } as const;
    expect(destinatariosDoAviso(aviso, pessoas).map((p) => p.id)).toEqual(["dono"]);
  });
});

describe("planejarEntregas (deduplicação)", () => {
  const pessoas = [pessoa("u1"), pessoa("u2")];
  const aviso = (chave: string, alvo: AvisoNovo["alvo"] = { tipo: "todos" }): AvisoNovo => ({
    alvo,
    tipo: "disputa_48h",
    titulo: "t",
    corpo: "c",
    link: null,
    chave,
  });

  it("aviso para todos vira uma linha só e não se repete", () => {
    const [primeira] = planejarEntregas([aviso("k1")], [], pessoas);
    expect(primeira?.paineis).toEqual([null]);
    expect(primeira?.pessoas.map((p) => p.id)).toEqual(["u1", "u2"]);
    expect(planejarEntregas([aviso("k1")], [{ chave: "k1", usuarioId: null }], pessoas)).toEqual([]);
  });

  it("repetido dentro da própria lista entra uma vez só", () => {
    expect(planejarEntregas([aviso("k1"), aviso("k1"), aviso("k2")], [], pessoas)).toHaveLength(2);
  });

  it("aviso por permissão só é cortado para quem já recebeu", () => {
    const porPermissao = aviso("k3", { tipo: "permissao", permissao: "aprovar_propostas" });
    const gestores = [pessoa("g1", { permissoes: ["aprovar_propostas"] }), pessoa("g2", { permissoes: ["aprovar_propostas"] })];
    const [entrega] = planejarEntregas([porPermissao], [{ chave: "k3", usuarioId: "g1" }], gestores);
    expect(entrega?.paineis).toEqual(["g2"]);
    expect(entrega?.pessoas.map((p) => p.id)).toEqual(["g2"]);
  });

  it("outro destino não conta como duplicado", () => {
    expect(planejarEntregas([aviso("k4", { tipo: "pessoa", usuarioId: "u2" })], [{ chave: "k4", usuarioId: "u1" }], pessoas)).toHaveLength(1);
  });
});

describe("diaDeSaoPaulo", () => {
  it("usa o dia civil de São Paulo", () => {
    expect(diaDeSaoPaulo(new Date("2026-11-12T02:00:00.000Z"))).toBe("2026-11-11");
    expect(diaDeSaoPaulo(new Date("2026-11-12T10:00:00.000Z"))).toBe("2026-11-12");
  });
});
