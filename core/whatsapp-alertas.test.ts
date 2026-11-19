import { describe, expect, it } from "vitest";
import {
  VALOR_GRANDE_PADRAO,
  aceitaAlerta,
  alertasDePrazo,
  botoesDoAlerta,
  dentroDoHorario,
  escolhasDoPerfil,
  faixaDoPrazo,
  gerarCodigoAtivacao,
  inicioDaSemana,
  janelaAberta,
  lerComando,
  lerEscolhas,
  lerEventoRecebido,
  lerPayload,
  linkAtivacao,
  mesDeSaoPaulo,
  payloadDoBotao,
  quandoFecha,
  textoDoResumo,
  textoResumoManha,
  tituloAtribuir,
  type AcaoBotao,
  type DadosResumoManha,
  type ItemAlerta,
  type MovimentoEquipe,
  type NovaDoRamo,
  type PessoaWa,
  type TipoAlertaWa,
} from "./whatsapp-alertas";

const HORA = 3_600_000;
const MIN = 60_000;
// 12h em São Paulo (UTC-3)
const AGORA = new Date("2026-05-12T15:00:00Z");
const depois = (ms: number): string => new Date(AGORA.getTime() + ms).toISOString();

const ana: PessoaWa = { id: "ana", ativa: true, prazos: true };
const beto: PessoaWa = { id: "beto", ativa: true, prazos: true };
const caio: PessoaWa = { id: "caio", ativa: false, prazos: true };
const dora: PessoaWa = { id: "dora", ativa: true, prazos: false };

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

describe("perfil de alerta", () => {
  it("sem escolha gravada: dono acompanha, gestor e jurídico operam", () => {
    expect(lerEscolhas(null, "dono")).toEqual(escolhasDoPerfil("acompanhamento"));
    expect(lerEscolhas(null, "gestor")).toEqual(escolhasDoPerfil("operacional"));
    expect(lerEscolhas(undefined, "juridico").perfil).toBe("operacional");
  });
  it("operacional recebe o dia a dia; acompanhamento só o placar", () => {
    const op = escolhasDoPerfil("operacional");
    expect(op).toMatchObject({ prazos: true, novas: true, fechando: true, aguardando: true, pendencias: true, movimentos: false, grandes: false, meta: true });
    const ac = escolhasDoPerfil("acompanhamento");
    expect(ac).toMatchObject({ prazos: false, novas: false, pendencias: false, movimentos: true, disputa: true, grandes: true, meta: true });
  });
  it("campo gravado vence o padrão do perfil; lixo volta ao padrão", () => {
    const e = lerEscolhas({ perfil: "acompanhamento", prazos: true, valorGrande: 50_000 }, "gestor");
    expect(e).toMatchObject({ perfil: "acompanhamento", prazos: true, movimentos: true, valorGrande: 50_000 });
    expect(lerEscolhas({ perfil: "chefe" }, "gestor")).toEqual(escolhasDoPerfil("operacional"));
    expect(lerEscolhas("texto", "dono")).toEqual(escolhasDoPerfil("acompanhamento"));
    expect(lerEscolhas({ valorGrande: -5 }, "dono").valorGrande).toBe(VALOR_GRANDE_PADRAO);
  });
  it("na fila só entra prazo urgente e aviso, conforme a escolha", () => {
    const op = escolhasDoPerfil("operacional");
    const ac = escolhasDoPerfil("acompanhamento");
    expect(aceitaAlerta(op, "prazo2")).toBe(true);
    expect(aceitaAlerta(op, "prazo24")).toBe(true);
    expect(aceitaAlerta(op, "aviso")).toBe(true);
    for (const tipo of ["prazo48", "radar", "sem_responsavel", "etapa"] as const) expect(aceitaAlerta(op, tipo)).toBe(false);
    expect(aceitaAlerta(ac, "prazo2")).toBe(false);
    expect(aceitaAlerta(ac, "aviso")).toBe(false);
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
  it("responsável inativo ou que não quer prazos: vai a quem quer", () => {
    expect(alertasDePrazo([item({ id: "i1", responsavelId: "caio" })], [ana, caio], AGORA).map((a) => a.usuarioId)).toEqual(["ana"]);
    expect(alertasDePrazo([item({ id: "i1", responsavelId: "dora" })], [ana, dora], AGORA).map((a) => a.usuarioId)).toEqual(["ana"]);
  });
  it("sem responsável vai a todas as pessoas ativas que querem prazos", () => {
    const r = alertasDePrazo([item({ id: "i1" })], [ana, beto, caio, dora], AGORA);
    expect(r.map((a) => a.usuarioId)).toEqual(["ana", "beto"]);
    expect(r[0]?.tipo).toBe("prazo24");
  });
  it("só 24 h e 2 h: o de 48 h fica para o resumo", () => {
    expect(alertasDePrazo([item({ id: "i1", dataEncerramento: depois(30 * HORA) })], [ana], AGORA)).toHaveLength(0);
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

describe("textoDoResumo", () => {
  it("lista vazia gera texto vazio", () => {
    expect(textoDoResumo([])).toBe("");
  });
  it("conta por tipo e traz a dica", () => {
    const itens: Array<{ tipo: TipoAlertaWa; texto: string }> = [
      { tipo: "prazo2", texto: "p1" },
      { tipo: "prazo24", texto: "p2" },
      { tipo: "aviso", texto: "a1" },
    ];
    const t = textoDoResumo(itens);
    expect(t).toContain("Urgente: 2 prazos, 1 aviso");
    expect(t).toContain("p1");
    expect(t).not.toContain("+");
    expect(t).toContain("Responda *prazos* ou *pipeline* para ver mais.");
  });
  it("mostra no máximo 8 e resume o resto", () => {
    const itens = Array.from({ length: 11 }, (_, i) => ({ tipo: "prazo24" as const, texto: `t${i}` }));
    const t = textoDoResumo(itens);
    expect(t).toContain("11 prazos");
    expect(t).toContain("t7");
    expect(t).not.toContain("t8");
    expect(t).toContain("+3");
  });
});

function nova(parcial: Partial<NovaDoRamo> & { id: string }): NovaDoRamo {
  return {
    objeto: "Aquisição de toner para impressoras",
    valor: 12_500,
    municipio: "Nova Iguaçu",
    uf: "RJ",
    modalidade: "Dispensa",
    // 20/05 às 14h em São Paulo
    dataEncerramento: "2026-05-20T17:00:00Z",
    bateu: "Equipamentos e suprimentos de informática: toner",
    ...parcial,
  };
}

function dados(parcial: Partial<DadosResumoManha> = {}): DadosResumoManha {
  return {
    usuarioId: "ana",
    nome: "Ana Souza",
    escolhas: escolhasDoPerfil("operacional"),
    novas: [],
    itens: [],
    movimentos: [],
    pendencias: [],
    disputasNaSemana: 0,
    meta: { minimo: 5, ideal: 10 },
    ...parcial,
  };
}

describe("textoResumoManha", () => {
  it("novas do ramo com valor, cidade/UF, modalidade, quando fecha e o que bateu", () => {
    const r = textoResumoManha(dados({ novas: [nova({ id: "n1" }), nova({ id: "n2", valor: null, objeto: "Papel A4" })] }), AGORA);
    expect(r.texto).toContain("☀️ Bom dia, Ana!");
    expect(r.texto).toContain("🆕 2 novas do seu ramo");
    expect(r.texto).toContain("1. *Aquisição de toner para impressoras*");
    expect(r.texto).toContain("R$ 12.500 · Nova Iguaçu/RJ · Dispensa");
    expect(r.texto).toContain("Fecha 20/05 às 14h · Bateu: Equipamentos e suprimentos de informática: toner");
    expect(r.texto).toContain("Valor sigiloso");
    expect(r.novasMostradas).toEqual(["n1", "n2"]);
  });
  it("lista até 8 novas e conta o resto", () => {
    const novas = Array.from({ length: 11 }, (_, i) => nova({ id: `n${i}` }));
    const r = textoResumoManha(dados({ novas }), AGORA);
    expect(r.texto).toContain("🆕 11 novas do seu ramo");
    expect(r.texto).toContain("8. *");
    expect(r.texto).not.toContain("9. *");
    expect(r.texto).toContain("+3");
    expect(r.novasMostradas).toHaveLength(8);
  });
  it("fecham em 48 h, aguardando resultado, pendências e meta", () => {
    const itens = [
      item({ id: "a", dataEncerramento: depois(30 * HORA) }),
      item({ id: "b", dataEncerramento: depois(100 * HORA) }),
      item({ id: "c", etapa: "disputa", objeto: "Cadeiras", dataEncerramento: depois(-5 * HORA) }),
      item({ id: "d", etapa: "perdida", dataEncerramento: depois(-5 * HORA) }),
    ];
    const r = textoResumoManha(dados({ itens, pendencias: ["📝 Proposta para revisar\nDetalhe"], disputasNaSemana: 2 }), AGORA);
    expect(r.texto).toContain("⏰ Fecham em 48 h: 1");
    expect(r.texto).toContain("(em 1 d 6 h)");
    expect(r.texto).toContain("⌛ Aguardando resultado: 1\n• Cadeiras");
    expect(r.texto).toContain("📌 Para você: 1\n• 📝 Proposta para revisar");
    expect(r.texto).not.toContain("Detalhe");
    expect(r.texto).toContain("🎯 Meta da semana: 2 de 10 (mínimo 5). Faltam 3 para o mínimo.");
  });
  it("acompanhamento: movimentos da equipe, disputas, grandes e meta; sem o operacional", () => {
    const movimentos: MovimentoEquipe[] = [
      { itemId: "i1", objeto: "Notebooks", de: "proposta", para: "disputa", porId: "paulo", porNome: "Paulo Henrique" },
      { itemId: "i2", objeto: "Toner", de: "radar", para: "analisando", porId: "paulo", porNome: "Paulo Henrique" },
      { itemId: "i3", objeto: "Feito por mim", de: "radar", para: "cotando", porId: "dono", porNome: "Dono" },
    ];
    const r = textoResumoManha(
      dados({
        usuarioId: "dono",
        nome: "Dono",
        escolhas: escolhasDoPerfil("acompanhamento"),
        movimentos,
        novas: [nova({ id: "g1", valor: 250_000, objeto: "Servidores" }), nova({ id: "p1", valor: 9_000 })],
        itens: [item({ id: "a", dataEncerramento: depois(30 * HORA) })],
        pendencias: ["não deve aparecer"],
        disputasNaSemana: 5,
      }),
      AGORA,
    );
    expect(r.texto).toContain("👥 A equipe moveu 2 itens nas últimas 24 h");
    expect(r.texto).toContain("• Paulo: Notebooks → Em disputa");
    expect(r.texto).not.toContain("Feito por mim");
    expect(r.texto).toContain("🏁 Entraram em disputa: 1\n• Notebooks");
    expect(r.texto).toContain("💰 Acima de R$ 100 mil: 1");
    expect(r.texto).toContain("*Servidores*");
    expect(r.texto).not.toContain("novas do seu ramo");
    expect(r.texto).not.toContain("Fecham em 48 h");
    expect(r.texto).not.toContain("não deve aparecer");
    expect(r.texto).toContain("Meta batida!");
    expect(r.novasMostradas).toEqual(["g1"]);
  });
  it("ideal batido", () => {
    expect(textoResumoManha(dados({ disputasNaSemana: 10 }), AGORA).texto).toContain("🎯 Meta da semana: 10 de 10 (mínimo 5). Ideal batido!");
  });
  it("usa a meta configurada pela empresa", () => {
    const r = textoResumoManha(dados({ disputasNaSemana: 2, meta: { minimo: 3, ideal: 6 } }), AGORA);
    expect(r.texto).toContain("🎯 Meta da semana: 2 de 6 (mínimo 3). Falta 1 para o mínimo.");
  });
  it("nada escolhido ou nada a dizer: vazio", () => {
    const nada = { ...escolhasDoPerfil("operacional"), meta: false };
    expect(textoResumoManha(dados({ escolhas: nada }), AGORA)).toEqual({ texto: "", novasMostradas: [] });
  });
});

describe("datas do resumo", () => {
  it("quandoFecha no horário de São Paulo", () => {
    expect(quandoFecha("2026-05-20T17:00:00Z")).toBe("20/05 às 14h");
    expect(quandoFecha("2026-05-20T17:30:00Z")).toBe("20/05 às 14h30");
    expect(quandoFecha("lixo")).toBe("sem data");
  });
  it("início da semana é segunda 0h em São Paulo", () => {
    // 12/05/2026 é terça
    expect(inicioDaSemana(AGORA).toISOString()).toBe("2026-05-11T03:00:00.000Z");
    // domingo 17/05 às 23h em São Paulo ainda é a semana de 11/05
    expect(inicioDaSemana(new Date("2026-05-18T02:00:00Z")).toISOString()).toBe("2026-05-11T03:00:00.000Z");
    // segunda 18/05 às 0h30 em São Paulo
    expect(inicioDaSemana(new Date("2026-05-18T03:30:00Z")).toISOString()).toBe("2026-05-18T03:00:00.000Z");
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
    expect(botoesDoAlerta("prazo24", "i1").map((x) => x.titulo)).toEqual(["Vou participar", "Atribuir a mim", "Descartar"]);
    const b = botoesDoAlerta("prazo24", "i1", "Paulo Henrique");
    expect(b.map((x) => x.titulo)).toEqual(["Vou participar", "Atribuir a Paulo", "Descartar"]);
    expect(b[1]?.payload).toBe("atr:i1");
    for (const x of b) {
      expect(x.titulo.length).toBeLessThanOrEqual(20);
      expect(x.payload.length).toBeLessThanOrEqual(256);
    }
    expect(botoesDoAlerta("radar", null)).toEqual([]);
    expect(botoesDoAlerta("aviso", "i1")).toEqual([]);
    expect(botoesDoAlerta("etapa", null)).toEqual([]);
  });
  it("título do atribuir corta nome longo em 20 caracteres", () => {
    expect(tituloAtribuir(null)).toBe("Atribuir a mim");
    expect(tituloAtribuir("  ")).toBe("Atribuir a mim");
    const longo = tituloAtribuir("Maximiliano de Souza");
    expect(longo.length).toBeLessThanOrEqual(20);
    expect(longo.startsWith("Atribuir a Maximil")).toBe(true);
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
