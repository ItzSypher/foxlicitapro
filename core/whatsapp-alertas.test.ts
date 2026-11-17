import { describe, expect, it } from "vitest";
import {
  alertasDeEtapa,
  alertasDePrazo,
  alertasDeRadar,
  alertasSemResponsavel,
  botoesDoAlerta,
  dentroDoHorario,
  faixaDoPrazo,
  gerarCodigoAtivacao,
  janelaAberta,
  lerComando,
  lerEventoRecebido,
  lerPayload,
  linkAtivacao,
  mesDeSaoPaulo,
  payloadDoBotao,
  textoDoResumo,
  textoResumoManha,
  type AcaoBotao,
  type ItemAlerta,
  type MudancaEtapa,
  type PessoaWa,
  type TipoAlertaWa,
} from "./whatsapp-alertas";

const HORA = 3_600_000;
const MIN = 60_000;
// 12h em São Paulo (UTC-3)
const AGORA = new Date("2026-05-12T15:00:00Z");
const depois = (ms: number): string => new Date(AGORA.getTime() + ms).toISOString();

const ana: PessoaWa = { id: "ana", ativa: true };
const beto: PessoaWa = { id: "beto", ativa: true };
const caio: PessoaWa = { id: "caio", ativa: false };

function item(parcial: Partial<ItemAlerta> & { id: string }): ItemAlerta {
  return { etapa: "analisando", objeto: "Aquisição de material de escritório", dataEncerramento: depois(10 * HORA), responsavelId: null, ...parcial };
}

describe("janelaAberta", () => {
  it("fica aberta até 23h30 depois da última entrada", () => {
    expect(janelaAberta(new Date(AGORA.getTime() - (23 * HORA + 29 * MIN)), AGORA)).toBe(true);
  });
  it("fecha depois de 23h30", () => {
    expect(janelaAberta(new Date(AGORA.getTime() - (23 * HORA + 31 * MIN)), AGORA)).toBe(false);
  });
  it("sem entrada, fechada", () => {
    expect(janelaAberta(null, AGORA)).toBe(false);
  });
});

describe("horário", () => {
  it("respeita 7h a 20h em São Paulo", () => {
    expect(dentroDoHorario(new Date("2026-05-12T09:59:00Z"))).toBe(false); // 6h59
    expect(dentroDoHorario(new Date("2026-05-12T10:00:00Z"))).toBe(true); // 7h
    expect(dentroDoHorario(new Date("2026-05-12T23:59:00Z"))).toBe(true); // 20h59
    expect(dentroDoHorario(new Date("2026-05-13T00:00:00Z"))).toBe(false); // 21h
  });
  it("mês em São Paulo", () => {
    expect(mesDeSaoPaulo(new Date("2026-06-01T01:00:00Z"))).toBe("2026-05");
    expect(mesDeSaoPaulo(AGORA)).toBe("2026-05");
  });
});

describe("faixaDoPrazo", () => {
  const f = (ms: number) => faixaDoPrazo(new Date(AGORA.getTime() + ms), AGORA);
  it("respeita os limites", () => {
    expect(f(0)).toBeNull();
    expect(f(-HORA)).toBeNull();
    expect(f(1)).toBe("prazo2");
    expect(f(2 * HORA)).toBe("prazo2");
    expect(f(2 * HORA + 1)).toBe("prazo24");
    expect(f(24 * HORA)).toBe("prazo24");
    expect(f(24 * HORA + 1)).toBe("prazo48");
    expect(f(48 * HORA)).toBe("prazo48");
    expect(f(48 * HORA + 1)).toBeNull();
  });
});

describe("alertasDePrazo", () => {
  it("vai ao responsável quando ele está ativo", () => {
    const r = alertasDePrazo([item({ id: "i1", responsavelId: "ana", dataEncerramento: depois(HORA) })], [ana, beto], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ usuarioId: "ana", tipo: "prazo2", chave: "prazo2:i1", itemId: "i1" });
    expect(r[0]?.texto).toContain("⏰ Prazo em 1 h");
    expect(r[0]?.validade?.toISOString()).toBe(depois(HORA));
  });
  it("não envia se o responsável não está ativo", () => {
    expect(alertasDePrazo([item({ id: "i1", responsavelId: "caio" })], [ana, caio], AGORA)).toHaveLength(0);
  });
  it("sem responsável vai a todas as pessoas ativas", () => {
    const r = alertasDePrazo([item({ id: "i1" })], [ana, beto, caio], AGORA);
    expect(r.map((a) => a.usuarioId)).toEqual(["ana", "beto"]);
    expect(r[0]?.tipo).toBe("prazo24");
  });
  it("ignora etapas encerradas e prazos fora da janela", () => {
    const itens = [item({ id: "a", etapa: "ganha" }), item({ id: "b", etapa: "perdida" }), item({ id: "c", dataEncerramento: depois(72 * HORA) })];
    expect(alertasDePrazo(itens, [ana], AGORA)).toHaveLength(0);
  });
  it("a chave não se repete por pessoa", () => {
    const r = alertasDePrazo([item({ id: "i1" }), item({ id: "i2" })], [ana, beto], AGORA);
    const chaves = r.map((a) => `${a.usuarioId}|${a.chave}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("alertasDeRadar", () => {
  const base = { id: "o1", objeto: "Compra de notebooks", nota: 85, dataEncerramento: depois(72 * HORA), link: "https://x/l/1" };
  it("avisa as pessoas ativas com nota, objeto e link", () => {
    const r = alertasDeRadar([base], [ana, caio], new Set(), AGORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ usuarioId: "ana", tipo: "radar", chave: "radar:o1", itemId: null });
    expect(r[0]?.texto).toContain("85");
    expect(r[0]?.texto).toContain("https://x/l/1");
  });
  it("ignora nota baixa, encerrada e quem já está no pipeline", () => {
    const r = alertasDeRadar(
      [
        { ...base, id: "baixa", nota: 79 },
        { ...base, id: "velha", dataEncerramento: depois(-HORA) },
        { ...base, id: "no-pipeline" },
      ],
      [ana],
      new Set(["no-pipeline"]),
      AGORA,
    );
    expect(r).toHaveLength(0);
  });
  it("não repete a mesma oportunidade", () => {
    expect(alertasDeRadar([base, base], [ana], new Set(), AGORA)).toHaveLength(1);
  });
});

describe("alertasSemResponsavel", () => {
  it("um por dia por pessoa, só itens abertos e sem responsável", () => {
    const itens = [item({ id: "a" }), item({ id: "b", responsavelId: "ana" }), item({ id: "c", etapa: "ganha" })];
    const r = alertasSemResponsavel(itens, [ana, beto, caio], AGORA);
    expect(r.map((x) => x.chave)).toEqual(["semresp:a:2026-05-12", "semresp:a:2026-05-12"]);
    expect(r.map((x) => x.usuarioId)).toEqual(["ana", "beto"]);
    expect(r[0]?.itemId).toBe("a");
  });
  it("no dia seguinte a chave muda", () => {
    const r = alertasSemResponsavel([item({ id: "a" })], [ana], new Date(AGORA.getTime() + 24 * HORA));
    expect(r[0]?.chave).toBe("semresp:a:2026-05-13");
  });
});

describe("alertasDeEtapa", () => {
  const mudanca: MudancaEtapa = {
    historicoId: "7",
    itemId: "i1",
    objeto: "Aquisição de cadeiras",
    de: "cotando",
    para: "proposta",
    porId: "ana",
    responsavelId: "ana",
  };
  it("avisa responsável e donos, menos quem moveu", () => {
    const r = alertasDeEtapa([{ ...mudanca, porId: "beto" }], [ana, beto, caio], new Set(["beto", "caio"]));
    expect(r.map((a) => a.usuarioId)).toEqual(["ana"]);
    expect(r[0]?.chave).toBe("etapa:7");
    expect(r[0]?.validade).toBeNull();
    expect(r[0]?.texto).toContain("Cotando fornecedor → Proposta pronta");
  });
  it("quem moveu não recebe", () => {
    const r = alertasDeEtapa([mudanca], [ana, beto], new Set(["beto"]));
    expect(r.map((a) => a.usuarioId)).toEqual(["beto"]);
  });
  it("dono que também é responsável recebe uma vez", () => {
    const r = alertasDeEtapa([{ ...mudanca, porId: null }], [ana], new Set(["ana"]));
    expect(r).toHaveLength(1);
  });
});

describe("textoDoResumo", () => {
  it("lista vazia gera texto vazio", () => {
    expect(textoDoResumo([])).toBe("");
  });
  it("conta por tipo e traz a dica", () => {
    const itens: Array<{ tipo: TipoAlertaWa; texto: string }> = [
      { tipo: "prazo2", texto: "p1" },
      { tipo: "prazo24", texto: "p2" },
      { tipo: "prazo48", texto: "p3" },
      { tipo: "radar", texto: "r1" },
    ];
    const t = textoDoResumo(itens);
    expect(t).toContain("Enquanto você estava fora: 3 prazos, 1 licitação nova");
    expect(t).toContain("p1");
    expect(t).not.toContain("+");
    expect(t).toContain("Responda *prazos* ou *pipeline* para ver mais.");
  });
  it("mostra no máximo 8 e resume o resto", () => {
    const itens = Array.from({ length: 11 }, (_, i) => ({ tipo: "aviso" as const, texto: `t${i}` }));
    const t = textoDoResumo(itens);
    expect(t).toContain("11 avisos");
    expect(t).toContain("t7");
    expect(t).not.toContain("t8");
    expect(t).toContain("+3");
  });
});

describe("textoResumoManha", () => {
  it("conta itens, prazos de 48 h e sem responsável", () => {
    const t = textoResumoManha(
      [item({ id: "a", responsavelId: "ana", dataEncerramento: depois(30 * HORA) }), item({ id: "b", dataEncerramento: depois(100 * HORA) }), item({ id: "c", etapa: "perdida" })],
      AGORA,
    );
    expect(t).toContain("2 itens em jogo");
    expect(t).toContain("Fecham em 48 h: 1");
    expect(t).toContain("Sem responsável: 1");
  });
  it("sem itens em jogo, vazio", () => {
    expect(textoResumoManha([item({ id: "c", etapa: "ganha" })], AGORA)).toBe("");
  });
});

describe("lerComando", () => {
  it("ativar com código em maiúsculas", () => {
    expect(lerComando("  ativar   ab3k9z ")).toEqual({ tipo: "ativar", codigo: "AB3K9Z" });
    expect(lerComando("ATIVAR AB3K9Z")).toEqual({ tipo: "ativar", codigo: "AB3K9Z" });
  });
  it("ativar com código de tamanho errado é texto livre", () => {
    expect(lerComando("ativar abc").tipo).toBe("livre");
  });
  it("palavras-chave sem acento nem caixa", () => {
    expect(lerComando("Pipeline")).toEqual({ tipo: "pipeline" });
    expect(lerComando("PRAZOS")).toEqual({ tipo: "prazos" });
    expect(lerComando("prazo")).toEqual({ tipo: "prazos" });
    expect(lerComando("Sair")).toEqual({ tipo: "parar" });
    expect(lerComando("stop")).toEqual({ tipo: "parar" });
    expect(lerComando("Receber alertas")).toEqual({ tipo: "voltar" });
    expect(lerComando("continuar  recebendo")).toEqual({ tipo: "voltar" });
    expect(lerComando("Sim!")).toEqual({ tipo: "sim" });
    expect(lerComando("CONFIRMO")).toEqual({ tipo: "sim" });
    expect(lerComando("Não")).toEqual({ tipo: "nao" });
    expect(lerComando("nao")).toEqual({ tipo: "nao" });
    expect(lerComando("Cancelar")).toEqual({ tipo: "nao" });
  });
  it("o resto é texto livre, sem mexer no original", () => {
    expect(lerComando("  Quanto custa?  ")).toEqual({ tipo: "livre", texto: "Quanto custa?" });
  });
});

describe("botões", () => {
  it("ida e volta do payload", () => {
    const acoes: AcaoBotao[] = [
      { tipo: "participar", itemId: "12345678000190-1-000123/2025" },
      { tipo: "atribuir", itemId: "x" },
      { tipo: "descartar", itemId: "y:z" },
      { tipo: "confirmar" },
      { tipo: "cancelar" },
      { tipo: "continuar" },
    ];
    for (const a of acoes) expect(lerPayload(payloadDoBotao(a))).toEqual(a);
    expect(payloadDoBotao({ tipo: "participar", itemId: "abc" })).toBe("part:abc");
  });
  it("payload desconhecido é nulo", () => {
    expect(lerPayload("")).toBeNull();
    expect(lerPayload("part:")).toBeNull();
    expect(lerPayload("xyz:1")).toBeNull();
    expect(lerPayload("qualquer")).toBeNull();
  });
  it("botões por tipo, com título de até 20 caracteres", () => {
    const b = botoesDoAlerta("prazo24", "i1");
    expect(b.map((x) => x.titulo)).toEqual(["Vou participar", "Atribuir a mim", "Descartar"]);
    for (const x of b) {
      expect(x.titulo.length).toBeLessThanOrEqual(20);
      expect(x.payload.length).toBeLessThanOrEqual(256);
    }
    expect(botoesDoAlerta("radar", null)).toEqual([]);
    expect(botoesDoAlerta("aviso", "i1")).toEqual([]);
    expect(botoesDoAlerta("etapa", null)).toEqual([]);
  });
});

describe("ativação", () => {
  it("gera 6 caracteres do alfabeto sem ambíguos", () => {
    let n = 0;
    const codigo = gerarCodigoAtivacao(() => {
      n += 0.137;
      return n % 1;
    });
    expect(codigo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(gerarCodigoAtivacao(() => 0.999999)).toBe("999999");
  });
  it("monta o link do wa.me", () => {
    expect(linkAtivacao("5521999990000", "AB3K9Z")).toBe("https://wa.me/5521999990000?text=ATIVAR%20AB3K9Z");
  });
});

describe("lerEventoRecebido", () => {
  it("lê o toque em botão com o metadata na raiz do evento (formato real do webhook)", () => {
    const corpo = {
      id: "evt-webhook",
      event: "message.received",
      message: { conversationId: "conv", direction: "incoming", text: "Vou participar", sender: { id: "5521994297816" } },
      account: { id: "acc", accountId: "acc" },
      metadata: { interactiveType: "button_reply", interactiveId: "part:33287806000161-1-000038/2026" },
    };
    expect(lerEventoRecebido(corpo, null)?.payloadBotao).toBe("part:33287806000161-1-000038/2026");
  });

  it("lê o toque em botão do formato real do Zernio (metadata.interactiveId)", () => {
    const corpo = {
      id: "evt-botao",
      event: "message.received",
      account: { accountId: "acc" },
      message: {
        conversationId: "conv",
        direction: "incoming",
        text: "Vou participar",
        sender: { id: "5521994297816" },
        metadata: { interactiveId: "part:33287806000161-1-000038/2026", interactiveType: "button_reply" },
      },
    };
    expect(lerEventoRecebido(corpo, null)?.payloadBotao).toBe("part:33287806000161-1-000038/2026");
  });

  const corpo = {
    id: "evt-1",
    event: "message.received",
    account: { accountId: "acc-1" },
    conversation: { id: "conv-0" },
    message: {
      conversationId: "conv-1",
      direction: "incoming",
      text: "ola",
      sender: { id: "+55 (21) 99999-0000", name: "Ana" },
      metadata: { buttonPayload: "part:i1" },
    },
  };
  it("lê uma mensagem recebida", () => {
    expect(lerEventoRecebido(corpo, null)).toEqual({
      eventoId: "evt-1",
      contaId: "acc-1",
      conversationId: "conv-1",
      remetente: "5521999990000",
      nome: "Ana",
      texto: "ola",
      payloadBotao: "part:i1",
    });
  });
  it("usa o cabeçalho quando o corpo não traz id e aceita direção ausente", () => {
    const r = lerEventoRecebido(
      { ...corpo, id: undefined, message: { ...corpo.message, direction: undefined } },
      "cab-9",
    );
    expect(r?.eventoId).toBe("cab-9");
  });
  it("procura o payload do botão nos outros caminhos", () => {
    const r = lerEventoRecebido({ ...corpo, message: { ...corpo.message, metadata: { interactive: { button_reply: { id: "sim" } } } } }, null);
    expect(r?.payloadBotao).toBe("sim");
    const s = lerEventoRecebido({ ...corpo, message: { ...corpo.message, metadata: {}, postback: { payload: "nao" } } }, null);
    expect(s?.payloadBotao).toBe("nao");
  });
  it("ignora outros eventos e mensagens enviadas", () => {
    expect(lerEventoRecebido({ ...corpo, event: "message.sent" }, null)).toBeNull();
    expect(lerEventoRecebido({ ...corpo, message: { ...corpo.message, direction: "outgoing" } }, null)).toBeNull();
  });
  it("lixo não quebra", () => {
    expect(lerEventoRecebido(null, null)).toBeNull();
    expect(lerEventoRecebido("texto", null)).toBeNull();
    expect(lerEventoRecebido({ event: "message.received" }, null)).toBeNull();
    expect(lerEventoRecebido({ event: "message.received", message: { sender: {} } }, "x")).toBeNull();
  });
});
