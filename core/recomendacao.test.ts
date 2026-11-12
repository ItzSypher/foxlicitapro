import { describe, expect, it } from "vitest";
import { recomendar } from "./recomendacao";
import { calcularScore } from "./score";
import type { Frente, Oportunidade, OportunidadeComScore } from "./types";

const AGORA = new Date("2026-11-10T12:00:00-03:00");

let contador = 0;

function item(parcial: Partial<Oportunidade> = {}, frente: Frente = "servicos"): OportunidadeComScore {
  contador += 1;
  const base: Oportunidade = {
    id: `00000000000000-1-${String(contador).padStart(6, "0")}/2026`,
    objeto: "Manutenção de computadores e impressoras",
    valorEstimado: 5000,
    orgao: "PREFEITURA DE NOVA IGUAÇU",
    orgaoCnpj: "00000000000001",
    unidade: "Secretaria",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "nova-iguacu",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: "2026-11-09T08:00:00-03:00",
    dataEncerramento: "2026-11-13T08:00:00-03:00",
    anoCompra: 2026,
    sequencialCompra: contador,
    linkPncp: "https://pncp.gov.br/app/editais/00000000000000/2026/1",
    linkOrigem: null,
    ...parcial,
  };
  return { ...base, score: calcularScore(base, frente, AGORA) };
}

describe("recomendar: o que entra", () => {
  it("recomenda go e atenção com CNAE casado na frente ativa", () => {
    const go = item();
    const atencao = item({ modalidadeId: 6, regiao: "capital" });
    expect(go.score.faixa).toBe("go");
    expect(atencao.score.faixa).toBe("atencao");
    const r = recomendar([go, atencao], "servicos", AGORA);
    expect(r.map((x) => x.item.id)).toEqual([go.id, atencao.id]);
  });

  it("não recomenda nogo nem item que casou só com a outra frente", () => {
    const semMatch = item({ objeto: "Serviço de seguro para viaturas" });
    const outraFrente = item({ objeto: "Aquisição de toner" });
    expect(recomendar([semMatch, outraFrente], "servicos", AGORA)).toEqual([]);
  });

  it("exclui o que fecha em menos de 6 h e o que já fechou", () => {
    const urgente = item({ dataEncerramento: "2026-11-10T17:00:00-03:00" });
    const fechada = item({ dataEncerramento: "2026-11-10T08:00:00-03:00" });
    const folga = item({ dataEncerramento: "2026-11-10T18:30:00-03:00" });
    const r = recomendar([urgente, fechada, folga], "servicos", AGORA);
    expect(r.map((x) => x.item.id)).toEqual([folga.id]);
  });

  it("exclui valor acima do teto anual do MEI", () => {
    const caro = item({ valorEstimado: 81000.01 });
    const noTeto = item({ valorEstimado: 81000 });
    expect(recomendar([caro, noTeto], "servicos", AGORA).map((x) => x.item.id)).toEqual([noTeto.id]);
  });

  it("serviço fora do estado do Rio não entra", () => {
    expect(recomendar([item({ regiao: "fora-rj" })], "servicos", AGORA)).toEqual([]);
  });
});

describe("recomendar: prioridade e motivos", () => {
  it("soma os bônus à nota", () => {
    // nota 100 + cidade 8 + principal 4 + dispensa 4 + limite MEI 3 + 2 dias para cotar 3
    const [r] = recomendar([item()], "servicos", AGORA);
    expect(r.item.score.total).toBe(100);
    expect(r.prioridade).toBe(122);
  });

  it("escreve motivos para o dono ler, no máximo 3", () => {
    const [r] = recomendar([item()], "servicos", AGORA);
    expect(r.motivos).toEqual(["Na sua cidade", "É a sua atividade principal", "Dispensa: disputa simples"]);
    expect(r.motivos.length).toBeLessThanOrEqual(3);
  });

  it("cita o limite MEI do ano e os dias para cotar quando sobra espaço", () => {
    const [r] = recomendar(
      [item({ regiao: "capital", modalidadeId: 6, objeto: "Instalação de CFTV", dataEncerramento: "2026-11-13T08:00:00-03:00" })],
      "servicos",
      AGORA,
    );
    expect(r.motivos).toEqual(["Cabe no limite do MEI de 2026", "2 dias para cotar"]);
  });

  it("baixada vale 5 e capital não ganha bônus de local", () => {
    const baixada = recomendar([item({ regiao: "baixada" })], "servicos", AGORA)[0];
    const capital = recomendar([item({ regiao: "capital" })], "servicos", AGORA)[0];
    expect(baixada.motivos[0]).toBe("Na Baixada, perto de casa");
    expect(baixada.prioridade - baixada.item.score.total).toBe(5 + 4 + 4 + 3 + 3);
    expect(capital.prioridade - capital.item.score.total).toBe(4 + 4 + 3 + 3);
  });

  it("sem nenhum bônus, explica pela atividade", () => {
    const base = item({
      regiao: "capital",
      modalidadeId: 6,
      valorEstimado: null,
      objeto: "Instalação de CFTV",
      dataEncerramento: "2026-11-30T08:00:00-03:00",
    });
    const [r] = recomendar([base], "servicos", AGORA);
    expect(r.motivos).toEqual(["Casa com a sua atividade"]);
  });

  it("não dá bônus de valor abaixo de R$ 1.500", () => {
    const [r] = recomendar([item({ valorEstimado: 900, regiao: "capital" })], "servicos", AGORA);
    expect(r.motivos.some((m) => m.startsWith("Cabe no limite"))).toBe(false);
  });

  it("singular de 1 dia", () => {
    const [um] = recomendar(
      [item({ regiao: "capital", modalidadeId: 6, objeto: "Instalação de CFTV", dataEncerramento: "2026-11-11T13:00:00-03:00" })],
      "servicos",
      AGORA,
    );
    expect(um.motivos).toContain("1 dia para cotar");
  });
});

describe("recomendar: ordem, órgão e limite", () => {
  it("ordena por prioridade e desempata pelo prazo mais próximo", () => {
    const tarde = item({ dataEncerramento: "2026-11-20T08:00:00-03:00", orgaoCnpj: "1" });
    const cedo = item({ dataEncerramento: "2026-11-18T08:00:00-03:00", orgaoCnpj: "2" });
    const pior = item({ regiao: "capital", modalidadeId: 6, orgaoCnpj: "3" });
    expect(tarde.score.total).toBe(cedo.score.total);
    const r = recomendar([pior, tarde, cedo], "servicos", AGORA);
    expect(r.map((x) => x.item.id)).toEqual([cedo.id, tarde.id, pior.id]);
    expect(r[0].prioridade).toBe(r[1].prioridade);
    expect(r[1].prioridade).toBeGreaterThan(r[2].prioridade);
  });

  it("no máximo 3 do mesmo órgão", () => {
    const mesmoOrgao = Array.from({ length: 5 }, () => item({ orgaoCnpj: "9" }));
    const outro = item({ orgaoCnpj: "8", regiao: "capital", modalidadeId: 6 });
    const r = recomendar([...mesmoOrgao, outro], "servicos", AGORA);
    expect(r.filter((x) => x.item.orgaoCnpj === "9")).toHaveLength(3);
    expect(r).toHaveLength(4);
    expect(r.some((x) => x.item.id === outro.id)).toBe(true);
  });

  it("respeita o limite", () => {
    const lista = Array.from({ length: 30 }, (_, i) => item({ orgaoCnpj: String(i) }));
    expect(recomendar(lista, "servicos", AGORA)).toHaveLength(12);
    expect(recomendar(lista, "servicos", AGORA, 5)).toHaveLength(5);
  });

  it("não altera a lista recebida e é pura", () => {
    const lista = [item({ orgaoCnpj: "a" }), item({ orgaoCnpj: "b", regiao: "capital" })];
    const copia = [...lista];
    expect(recomendar(lista, "servicos", AGORA)).toEqual(recomendar(lista, "servicos", AGORA));
    expect(lista).toEqual(copia);
  });

  it("funciona na frente de produtos", () => {
    const toner = item({ objeto: "Aquisição de toner", regiao: "capital" }, "produtos");
    const [r] = recomendar([toner], "produtos", AGORA);
    expect(r.item.id).toBe(toner.id);
    expect(r.motivos).not.toContain("É a sua atividade principal");
  });
});

const PREFS = {
  termosPrioritarios: ["sistema", "software", "suporte tecnico", "rede logica"],
  termosBloqueadosParaVoce: ["cftv", "camera", "cameras", "videomonitoramento", "alarme"],
};

describe("recomendar: preferências", () => {
  it("sem preferências o comportamento antigo se mantém (CFTV entra)", () => {
    const cftv = item({ objeto: "Instalação de CFTV com câmeras" });
    expect(recomendar([cftv], "servicos", AGORA)).toHaveLength(1);
  });

  it("termo bloqueado tira do Para você, sem acento e em qualquer caixa", () => {
    const cftv = item({ objeto: "Instalação de CFTV", orgaoCnpj: "1" });
    const camera = item({ objeto: "Manutenção de computadores e CÂMERAS de segurança", orgaoCnpj: "2" });
    const ok = item({ objeto: "Manutenção de computadores", orgaoCnpj: "3" });
    const r = recomendar([cftv, camera, ok], "servicos", AGORA, 12, PREFS);
    expect(r.map((x) => x.item.id)).toEqual([ok.id]);
  });

  it("não bloqueia palavra que só contém o termo dentro de outra", () => {
    const ok = item({ objeto: "Manutenção de computadores do setor de alarmística" });
    const prefs = { termosPrioritarios: [], termosBloqueadosParaVoce: ["alarme"] };
    expect(recomendar([ok], "servicos", AGORA, 12, prefs)).toHaveLength(1);
  });

  it("termo prioritário dá +10 e o motivo de software", () => {
    const base = item({ objeto: "Licença de software de antivírus", orgaoCnpj: "1" });
    const sem = recomendar([base], "servicos", AGORA)[0];
    const com = recomendar([base], "servicos", AGORA, 12, PREFS)[0];
    expect(com.prioridade - sem.prioridade).toBe(10);
    expect(com.motivos[0]).toBe("Sistema/software: seu foco");
  });

  it("termo de serviço usa o motivo de serviço de TI", () => {
    const rede = item({ objeto: "Serviço de rede lógica e cabeamento estruturado" });
    const [r] = recomendar([rede], "servicos", AGORA, 12, PREFS);
    expect(r.motivos[0]).toBe("Serviço de TI: seu foco");
  });

  it("sistema de ar condicionado e de registro de preços não ganham o bônus de foco", () => {
    const frio = item({ objeto: "Manutenção de computadores e do sistema de ar condicionado" });
    const srp = item({ objeto: "Manutenção de computadores pelo Sistema de Registro de Preços" });
    const prefs = { termosPrioritarios: ["sistema"], termosBloqueadosParaVoce: [] };
    for (const o of [frio, srp]) {
      const [r] = recomendar([o], "servicos", AGORA, 12, prefs);
      expect(r.motivos.some((m) => m === "Sistema/software: seu foco"), o.objeto).toBe(false);
    }
  });

  it("nome de setor (Diretoria de Sistemas de Informação) não vira foco", () => {
    const o = item({ objeto: "Manutenção de computadores para a Diretoria de Sistemas de Informação" });
    const [r] = recomendar([o], "servicos", AGORA, 12, { termosPrioritarios: ["sistema"], termosBloqueadosParaVoce: [] });
    expect(r.motivos.some((m) => m.includes("Sistema/software"))).toBe(false);
  });

  it("software e serviço de TI sobem à frente de outras atividades", () => {
    const eletrica = item({ objeto: "Manutenção elétrica do prédio", orgaoCnpj: "1" });
    const software = item({ objeto: "Aquisição de licença de software de gestão", orgaoCnpj: "2" });
    const ti = item({ objeto: "Empresa especializada em serviços de TI", orgaoCnpj: "3" });
    const r = recomendar([eletrica, software, ti], "servicos", AGORA, 12, PREFS);
    expect(r[r.length - 1].item.id).toBe(eletrica.id);
  });
});
