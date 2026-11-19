import { describe, expect, it } from "vitest";
import { fonteDaOportunidade } from "../fonte";
import type { Oportunidade } from "../types";
import {
  chavePncpDoId,
  converter,
  lerResposta,
  manterDoAlerta,
  montarUrl,
  novasSemDuplicata,
  termosDosCnaes,
  veioDoAlerta,
  type LicitacaoAlerta,
} from "./alerta-licitacao";

/** Resposta montada a partir da documentação pública da API (licitacoesAbertas). */
const RESPOSTA = {
  totalLicitacoes: 3,
  paginas: 1,
  licitacoesPorPagina: 100,
  licitacoesNestaPagina: 3,
  licitacoes: [
    {
      id_licitacao: "PNCP-10779511000107-1-235-2026",
      titulo: "DISPENSA 12/2026",
      municipio_IBGE: "3303500",
      uf: "RJ",
      orgao: "Prefeitura de Nova Iguaçu (RJ)",
      abertura_datetime: "2026-12-30 09:00:00",
      objeto: "Manutenção de computadores e impressoras",
      link: "https://alertalicitacao.com.br/!licitacao/PNCP-10779511000107-1-235-2026",
      linkExterno: "https://pncp.gov.br/app/editais/10779511000107/2026/235",
      municipio: "Nova Iguaçu",
      abertura: "30/12/2026",
      aberturaComHora: "30/12/2026 09:00",
      id_tipo: "6",
      tipo: "Dispensa",
    },
    {
      id_licitacao: "DM-N-CBD39C0C",
      titulo: "DISPENSA ELETRONICA 7/2026",
      municipio_IBGE: "3301702",
      uf: "RJ",
      orgao: "Prefeitura de Duque de Caxias (RJ)",
      abertura_datetime: "2026-12-20 00:00:00",
      objeto: "Aquisição de toner para impressoras",
      link: "https://alertalicitacao.com.br/!licitacao/DM-N-CBD39C0C",
      linkExterno: "http://www.diariomunicipal.com.br/amupe/materia/CBD39C0C",
      municipio: "Duque de Caxias",
      id_tipo: "6",
      tipo: "Dispensa eletrônica",
    },
    { titulo: "sem id", uf: "RJ", abertura_datetime: "2026-12-30 09:00:00" },
  ],
};

const AGORA = new Date("2026-12-01T12:00:00-03:00");

function licitacao(indice: number): LicitacaoAlerta {
  const leitura = lerResposta(RESPOSTA);
  if (!leitura.ok) throw new Error(leitura.erro);
  const l = leitura.resposta.licitacoes[indice];
  if (!l) throw new Error("fixture vazia");
  return l;
}

describe("lerResposta", () => {
  it("lê as licitações e descarta a que não tem id", () => {
    const leitura = lerResposta(RESPOSTA);
    expect(leitura.ok).toBe(true);
    if (!leitura.ok) return;
    expect(leitura.resposta.licitacoes).toHaveLength(2);
    expect(leitura.resposta.totalLicitacoes).toBe(3);
  });

  it("aceita `id` no lugar de `id_licitacao`", () => {
    const leitura = lerResposta({ licitacoes: [{ id: "X-1", uf: "RJ", abertura_datetime: "2026-12-30 09:00:00" }] });
    expect(leitura.ok && leitura.resposta.licitacoes[0]?.id).toBe("X-1");
  });

  it("resposta com erros vira falha com a descrição", () => {
    const leitura = lerResposta({ totalErros: 1, erros: [{ codigo: 12, descricao: "Token inválido" }] });
    expect(leitura).toEqual({ ok: false, erro: "12: Token inválido" });
  });

  it("corpo fora do formato vira falha", () => {
    expect(lerResposta("texto").ok).toBe(false);
  });
});

describe("montarUrl", () => {
  it("manda uf, palavra_chave e modalidade 6, com termo composto entre aspas e sem o token", () => {
    const url = new URL(montarUrl({ ufs: ["rj", "SP"], palavrasChave: ["toner", "manutencao de computador"] }));
    expect(url.origin + url.pathname).toBe("https://alertalicitacao.com.br/api/v1/licitacoesAbertas/");
    expect(url.searchParams.get("uf")).toBe("RJ,SP");
    expect(url.searchParams.get("palavra_chave")).toBe('toner,"manutencao de computador"');
    expect(url.searchParams.get("modalidade")).toBe("6");
    expect(url.searchParams.get("pagina")).toBe("1");
    expect(url.searchParams.get("licitacoesPorPagina")).toBe("100");
    expect(url.searchParams.has("token")).toBe(false);
  });

  it("limita a 100 por página e aceita município e outras modalidades", () => {
    const url = new URL(
      montarUrl({ ufs: ["RJ"], palavrasChave: ["toner"], modalidades: [5, 6], municipioIbge: "3303500", pagina: 2, porPagina: 500 }),
    );
    expect(url.searchParams.get("modalidade")).toBe("5,6");
    expect(url.searchParams.get("municipio_ibge")).toBe("3303500");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("licitacoesPorPagina")).toBe("100");
  });

  it("recusa consulta sem UF ou sem palavra-chave", () => {
    expect(() => montarUrl({ ufs: [], palavrasChave: ["toner"] })).toThrow();
    expect(() => montarUrl({ ufs: ["RJ"], palavrasChave: [] })).toThrow();
    expect(() => montarUrl({ ufs: ["RJ"], palavrasChave: [" \" , "] })).toThrow();
  });
});

describe("chavePncpDoId", () => {
  it("monta o numeroControlePNCP no formato do PNCP", () => {
    expect(chavePncpDoId("PNCP-10779511000107-1-235-2026")).toEqual({
      cnpj: "10779511000107",
      sequencial: 235,
      ano: 2026,
      numeroControle: "10779511000107-1-000235/2026",
    });
    expect(chavePncpDoId("PNCP-10779511000107-1-000235-2026")?.numeroControle).toBe("10779511000107-1-000235/2026");
  });

  it("id de outra origem não é do PNCP", () => {
    expect(chavePncpDoId("DM-N-CBD39C0C")).toBeNull();
  });
});

describe("converter", () => {
  it("licitação do PNCP vira a mesma chave do PNCP e guarda o link do Alerta", () => {
    const o = converter(licitacao(0), AGORA);
    expect(o).toMatchObject({
      id: "10779511000107-1-000235/2026",
      orgaoCnpj: "10779511000107",
      anoCompra: 2026,
      sequencialCompra: 235,
      uf: "RJ",
      codigoIbge: "3303500",
      regiao: "nova-iguacu",
      modalidadeId: 8,
      valorEstimado: null,
      dataAbertura: "2026-12-30T09:00:00-03:00",
      dataEncerramento: "2026-12-30T09:00:00-03:00",
      linkPncp: "https://pncp.gov.br/app/editais/10779511000107/2026/235",
      linkAlerta: "https://alertalicitacao.com.br/!licitacao/PNCP-10779511000107-1-235-2026",
    });
    expect(o !== null && veioDoAlerta(o)).toBe(true);
  });

  it("licitação fora do PNCP ganha id próprio, sem CNPJ, e prazo até o fim do dia quando não há hora", () => {
    const o = converter(licitacao(1), AGORA);
    expect(o).toMatchObject({
      id: "ALERTA-DM-N-CBD39C0C",
      orgaoCnpj: "",
      sequencialCompra: 0,
      anoCompra: 2026,
      modalidadeNome: "Dispensa eletrônica",
      dataEncerramento: "2026-12-20T23:59:59-03:00",
      linkOrigem: "http://www.diariomunicipal.com.br/amupe/materia/CBD39C0C",
      linkAlerta: "https://alertalicitacao.com.br/!licitacao/DM-N-CBD39C0C",
    });
  });

  it("descarta licitação já encerrada", () => {
    expect(converter(licitacao(0), new Date("2027-01-02T00:00:00-03:00"))).toBeNull();
  });

  it("descarta licitação sem data de abertura válida", () => {
    expect(converter({ ...licitacao(0), abertura_datetime: "sem data" }, AGORA)).toBeNull();
    expect(converter({ ...licitacao(0), abertura_datetime: null }, AGORA)).toBeNull();
  });
});

describe("fonte", () => {
  it("sem link de origem reconhecido, a fonte é o Alerta Licitação", () => {
    const alerta = "https://alertalicitacao.com.br/!licitacao/X";
    expect(fonteDaOportunidade(null, alerta)).toBe("Alerta Licitação");
    expect(fonteDaOportunidade("http://www.diariomunicipal.com.br/x", alerta)).toBe("Alerta Licitação");
    expect(fonteDaOportunidade("https://bnccompras.com/x", alerta)).toBe("BNC");
    expect(fonteDaOportunidade(alerta)).toBe("Alerta Licitação");
    expect(fonteDaOportunidade(null)).toBe("Outro portal");
  });
});

describe("duplicata com o PNCP", () => {
  const leitura = lerResposta(RESPOSTA);
  const licitacoes = leitura.ok ? leitura.resposta.licitacoes : [];

  it("não repete o que o PNCP já trouxe (mesmo numeroControle)", () => {
    const novas = novasSemDuplicata(licitacoes, new Set(["10779511000107-1-000235/2026"]), AGORA);
    expect(novas.map((o) => o.id)).toEqual(["ALERTA-DM-N-CBD39C0C"]);
  });

  it("sem o PNCP no cache, entram as duas, uma só vez cada", () => {
    const novas = novasSemDuplicata([...licitacoes, ...licitacoes], new Set(), AGORA);
    expect(novas.map((o) => o.id)).toEqual(["10779511000107-1-000235/2026", "ALERTA-DM-N-CBD39C0C"]);
  });
});

describe("manterDoAlerta", () => {
  const base = converter(licitacao(1), AGORA) as Oportunidade;
  const doPncp: Oportunidade = { ...base, id: "1-1-000001/2026", linkAlerta: null };

  it("a lista nova do PNCP não apaga o que só o Alerta tem e ainda vale", () => {
    const lista = manterDoAlerta([base, doPncp], [{ ...doPncp, objeto: "atualizado" }], AGORA);
    expect(lista.map((o) => o.id)).toEqual(["1-1-000001/2026", "ALERTA-DM-N-CBD39C0C"]);
    expect(lista[0]?.objeto).toBe("atualizado");
  });

  it("descarta o do Alerta que já encerrou", () => {
    expect(manterDoAlerta([base], [], new Date("2027-01-01T00:00:00-03:00"))).toEqual([]);
  });
});

describe("termosDosCnaes", () => {
  it("sem CNAE conhecido não há termos", () => {
    expect(termosDosCnaes([{ codigo: "00.00-0-00" }])).toEqual([]);
  });

  it("respeita o máximo e não repete termo", () => {
    const termos = termosDosCnaes([{ codigo: "95.11-8-00" }, { codigo: "43.21-5-00" }], 15);
    expect(termos.length).toBeGreaterThan(0);
    expect(termos.length).toBeLessThanOrEqual(15);
    expect(new Set(termos).size).toBe(termos.length);
  });
});
