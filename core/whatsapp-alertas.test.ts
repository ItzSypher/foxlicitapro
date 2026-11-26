import { describe, expect, it } from "vitest";
import {
  VALOR_GRANDE_PADRAO,
  aceitaAlerta,
  alertasDePrazo,
  botoesDoAlerta,
  botoesDoResumoManha,
  dentroDoHorario,
  escolhasDoPerfil,
  escolherCanal,
  escolherPropostasDoDia,
  faixaDoPrazo,
  gerarCodigoAtivacao,
  inicioDaSemana,
  inicioDoDia,
  itemParaPriorizar,
  janelaAberta,
  juntarResumos,
  lerComando,
  lerEscolhas,
  lerEventoRecebido,
  lerPayload,
  linhaCurtaAndamento,
  linhaCurtaResumo,
  linkAtivacao,
  mesDeSaoPaulo,
  nomeParaModelo,
  parametroDoModelo,
  partesDoResumoManha,
  payloadDoBotao,
  quandoFecha,
  textoAndamento,
  linhaAvisoCusto,
  textoAvisoAoDono,
  textoDoResumo,
  textoRascunhoPronto,
  textoDaMeta,
  textoResumoManha,
  tituloAtribuir,
  type AcaoBotao,
  type BlocoResumo,
  type DadosAndamento,
  type DadosResumoManha,
  type ItemAlerta,
  type MovimentoEquipe,
  type MovimentoProposta,
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
  it("com o nome da empresa, o texto diz de qual é o prazo", () => {
    const r = alertasDePrazo([item({ id: "i1", dataEncerramento: depois(HORA) })], [ana], AGORA, "Beta");
    expect(r[0]?.texto).toContain("⏰ Prazo em 1 h (Beta)\n");
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
    propostasHoje: [],
    propostasMovidas: [],
    pendencias: [],
    disputasNaSemana: 0,
    vencidasNaSemana: { vencidas: 0, valor: 0, estimado: false },
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
    expect(r.texto).toContain("🎯 Meta: 2/5 disputas · faltam 3 até domingo\nPriorize: ");
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
    expect(r.texto).toContain("• Paulo: Notebooks (Proposta pronta → Em disputa)");
    expect(r.texto).not.toContain("Feito por mim");
    expect(r.texto).toContain("🏁 Entraram em disputa: 1\n• Notebooks");
    expect(r.texto).toContain("💰 Acima de R$ 100 mil: 1");
    expect(r.texto).toContain("*Servidores*");
    expect(r.texto).not.toContain("novas do seu ramo");
    expect(r.texto).not.toContain("Fecham em 48 h");
    expect(r.texto).not.toContain("não deve aparecer");
    expect(r.texto).toContain("🎯 Meta: 5/10 disputas · mínimo batido, faltam 5 até domingo para o ideal");
    expect(r.texto).not.toContain("Priorize");
    expect(r.novasMostradas).toEqual(["g1"]);
  });
  it("ideal batido", () => {
    expect(textoResumoManha(dados({ disputasNaSemana: 10 }), AGORA).texto).toContain("🎯 Meta: 10/10 disputas · ideal batido!");
  });
  it("acrescenta as vencidas da semana com o valor, só quando há", () => {
    const r = textoResumoManha(dados({ disputasNaSemana: 10, vencidasNaSemana: { vencidas: 2, valor: 12_500, estimado: false } }), AGORA);
    expect(r.texto).toContain("🎯 Meta: 10/10 disputas · ideal batido! · 2 vencidas (R$ 12.500)");
    expect(textoDaMeta(2, { minimo: 5, ideal: 10 }, { objeto: "Toner", restanteMs: 3 * HORA }, { vencidas: 1, valor: 8_000, estimado: true })).toContain(
      "🎯 Meta: 2/5 disputas · faltam 3 até domingo · 1 vencida (~R$ 8.000)\nPriorize: ",
    );
    expect(textoDaMeta(5, { minimo: 5, ideal: 10 }, null, { vencidas: 3, valor: 0, estimado: false })).toBe(
      "🎯 Meta: 5/10 disputas · mínimo batido, faltam 5 até domingo para o ideal · 3 vencidas",
    );
    expect(textoDaMeta(5, { minimo: 5, ideal: 10 }, null, { vencidas: 0, valor: 0, estimado: false })).not.toContain("vencida");
    expect(textoResumoManha(dados({ disputasNaSemana: 2 }), AGORA).texto).not.toContain("vencida");
  });
  it("usa a meta configurada pela empresa", () => {
    const r = textoResumoManha(dados({ disputasNaSemana: 2, meta: { minimo: 3, ideal: 6 } }), AGORA);
    expect(r.texto).toContain("🎯 Meta: 2/3 disputas · falta 1 até domingo");
  });
  it("nada escolhido ou nada a dizer: vazio", () => {
    const nada = { ...escolhasDoPerfil("operacional"), meta: false };
    expect(textoResumoManha(dados({ escolhas: nada }), AGORA)).toEqual({ texto: "", novasMostradas: [] });
  });
});

describe("juntarResumos", () => {
  const parteLonga = (titulo: string, n: number): string =>
    [titulo, ...Array.from({ length: n }, (_, i) => `• Item ${i + 1} ${"x".repeat(80)}`)].join("\n");

  it("uma mensagem só com a saudação e um bloco por empresa", () => {
    const blocos: BlocoResumo[] = [
      { empresa: "Alfa", partes: ["⏰ Fecham em 48 h: 1\n• Toner (em 10 h)", "🎯 Meta da semana: 0 de 10 (mínimo 5). Faltam 5 para o mínimo."] },
      { empresa: "Beta", partes: ["🎯 Meta da semana: 2 de 10 (mínimo 5). Faltam 3 para o mínimo."] },
    ];
    const texto = juntarResumos("Ana Souza", blocos);
    expect(texto.startsWith("☀️ Bom dia, Ana!\n\n🏢 *Alfa*\n\n⏰ Fecham em 48 h: 1")).toBe(true);
    expect(texto).toContain("\n\n🏢 *Beta*\n\n🎯 Meta da semana: 2 de 10");
    expect(texto.indexOf("*Alfa*")).toBeLessThan(texto.indexOf("*Beta*"));
    expect(texto).not.toContain("no sistema");
  });
  it("bloco sem partes não aparece; sem nenhum, texto vazio", () => {
    expect(juntarResumos("Ana", [{ empresa: "Alfa", partes: [] }, { empresa: "Beta", partes: ["🎯 Meta"] }])).not.toContain("Alfa");
    expect(juntarResumos("Ana", [{ empresa: "Alfa", partes: [] }])).toBe("");
    expect(juntarResumos("Ana", [])).toBe("");
  });
  it("passou do limite: corta as listas de cada bloco e avisa quantas ficaram de fora", () => {
    const blocos: BlocoResumo[] = [
      { empresa: "Alfa", partes: [parteLonga("⏰ Fecham em 48 h: 30", 30), "🎯 Meta da semana: 1 de 10 (mínimo 5)"] },
      { empresa: "Beta", partes: [parteLonga("⌛ Aguardando resultado: 30", 30)] },
    ];
    const texto = juntarResumos("Ana", blocos, 1500);
    expect(texto.length).toBeLessThanOrEqual(1500);
    expect(texto).toContain("*Alfa*");
    expect(texto).toContain("*Beta*");
    expect(texto).toContain("⏰ Fecham em 48 h: 30");
    expect(texto).toContain("⌛ Aguardando resultado: 30");
    expect(texto.match(/e mais \d+ no sistema/g)).toHaveLength(2);
    expect(texto).toContain("• Item 1 ");
  });
  it("bloco curto fica inteiro e deixa a sobra para o longo", () => {
    const blocos: BlocoResumo[] = [
      { empresa: "Alfa", partes: ["🎯 Meta da semana: 1 de 10 (mínimo 5)"] },
      { empresa: "Beta", partes: [parteLonga("⏰ Fecham em 48 h: 40", 40)] },
    ];
    const texto = juntarResumos("Ana", blocos, 1200);
    expect(texto.length).toBeLessThanOrEqual(1200);
    expect(texto).toContain("🎯 Meta da semana: 1 de 10 (mínimo 5)");
    expect(texto).toMatch(/e mais \d+ no sistema/);
    expect(texto.match(/e mais \d+ no sistema/g)).toHaveLength(1);
  });
  it("o +N da lista entra na conta do que ficou de fora", () => {
    const parte = [parteLonga("⏰ Fecham em 48 h: 25", 5), "+20"].join("\n");
    const texto = juntarResumos("Ana", [{ empresa: "Alfa", partes: [parte] }, { empresa: "Beta", partes: ["🎯 Meta"] }], 400);
    const omitidos = Number(/e mais (\d+) no sistema/.exec(texto)?.[1]);
    expect(omitidos).toBeGreaterThanOrEqual(20);
    expect(texto).not.toContain("\n+20");
  });
  it("partesDoResumoManha traz as mesmas partes do texto do resumo", () => {
    const d = dados({ disputasNaSemana: 2 });
    const { partes } = partesDoResumoManha(d, AGORA);
    expect(textoResumoManha(d, AGORA).texto).toBe(`☀️ Bom dia, Ana!\n\n${partes.join("\n\n")}`);
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
    expect(lerComando("Propostas")).toEqual({ tipo: "propostas" });
    expect(lerComando("proposta")).toEqual({ tipo: "propostas" });
    expect(lerComando(" 2 ")).toEqual({ tipo: "numero", numero: 2 });
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
    expect(lerComando("Ver resumo")).toEqual({ tipo: "ver_resumo" });
    expect(lerComando("resumo")).toEqual({ tipo: "ver_resumo" });
    expect(lerComando("Ver andamento")).toEqual({ tipo: "ver_andamento" });
  });
  it("o resto é texto livre, sem mexer no original", () => {
    expect(lerComando("  Quanto custa?  ")).toEqual({ tipo: "livre", texto: "Quanto custa?" });
  });
  it("analisar com link, só o link colado ou vários links", () => {
    const link = "https://pncp.gov.br/app/editais/12345678000199/2025/123";
    expect(lerComando("Analisar " + link)).toEqual({ tipo: "analisar", texto: "Analisar " + link });
    expect(lerComando(link)).toEqual({ tipo: "analisar", texto: link });
    expect(lerComando("veja esse " + link + "\n12345678000199-1-000007/2024").tipo).toBe("analisar");
    expect(lerComando("analisar").tipo).toBe("analisar");
    expect(lerComando("12345678000199-1-000123/2025").tipo).toBe("analisar");
  });
  it("pergunta longa com link segue para o assistente", () => {
    const texto = "o que você acha desse edital https://pncp.gov.br/app/editais/12345678000199/2025/123 para nós?";
    expect(lerComando(texto).tipo).toBe("livre");
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
      { tipo: "ver_resumo" },
      { tipo: "ver_andamento" },
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

describe("propostas do dia", () => {
  // 12h em São Paulo (AGORA); fecha às 18h de hoje = 21:00Z; amanhã 9h = 12:00Z do dia 13
  const hoje18 = "2026-05-12T21:00:00Z";
  const amanha9 = "2026-05-13T12:00:00Z";
  const depoisDeAmanha = "2026-05-14T12:00:00Z";
  const comValor = (parcial: Partial<ItemAlerta> & { id: string }): ItemAlerta => ({ ...item(parcial), valor: 5000 });

  it("escolhe só as etapas anteriores à disputa que fecham hoje ou amanhã, o mais próximo primeiro, no máximo 3", () => {
    const itens = [
      comValor({ id: "amanha", etapa: "cotando", dataEncerramento: amanha9 }),
      comValor({ id: "hoje", etapa: "radar", dataEncerramento: hoje18 }),
      comValor({ id: "longe", dataEncerramento: depoisDeAmanha }),
      comValor({ id: "disputa", etapa: "disputa", dataEncerramento: hoje18 }),
      comValor({ id: "fechou", dataEncerramento: "2026-05-12T14:00:00Z" }),
      comValor({ id: "a", etapa: "proposta", dataEncerramento: "2026-05-13T10:00:00Z" }),
      comValor({ id: "b", etapa: "analisando", dataEncerramento: "2026-05-13T11:00:00Z" }),
    ];
    const r = escolherPropostasDoDia(itens, new Set(), AGORA);
    expect(r.map((p) => p.itemId)).toEqual(["hoje", "a", "b"]);
    expect(r[0]).toMatchObject({ valor: 5000, dataEncerramento: hoje18 });
  });
  it("tira quem já tem proposta aprovada, pronta ou enviada", () => {
    const itens = [comValor({ id: "x", dataEncerramento: hoje18 }), comValor({ id: "y", dataEncerramento: amanha9 })];
    expect(escolherPropostasDoDia(itens, new Set(["x"]), AGORA).map((p) => p.itemId)).toEqual(["y"]);
  });
  it("o dia é o de São Paulo: 23h de hoje vale hoje, 1h de amanhã (UTC ainda hoje) vale amanhã", () => {
    const itens = [
      comValor({ id: "noite", dataEncerramento: "2026-05-13T02:30:00Z" }),
      comValor({ id: "madrugada", dataEncerramento: "2026-05-14T03:30:00Z" }),
    ];
    expect(escolherPropostasDoDia(itens, new Set(), AGORA).map((p) => p.itemId)).toEqual(["noite"]);
  });
  it("o resumo do gestor traz a seção numerada, a instrução e a meta com o que priorizar", () => {
    const propostasHoje = escolherPropostasDoDia(
      [comValor({ id: "h", etapa: "cotando", objeto: "Aquisição de toner", dataEncerramento: hoje18 }), comValor({ id: "m", dataEncerramento: amanha9, valor: null } as never)],
      new Set(),
      AGORA,
    );
    const r = textoResumoManha(dados({ propostasHoje, itens: [comValor({ id: "h", etapa: "cotando", dataEncerramento: hoje18 })], disputasNaSemana: 1 }), AGORA);
    expect(r.texto).toContain("📝 Propostas para hoje: 2");
    expect(r.texto).toContain("1. *");
    expect(r.texto).toContain("R$ 5.000 · fecha hoje às 18h");
    expect(r.texto).toContain("fecha amanhã às 09h");
    expect(r.texto).toContain("Responda *gerar 1* (ou toque no botão) que eu monto o rascunho.");
    expect(r.texto).toContain("🎯 Meta: 1/5 disputas · faltam 4 até domingo\nPriorize: ");
  });
  it("sem propostas do dia a seção não aparece", () => {
    expect(textoResumoManha(dados(), AGORA).texto).not.toContain("Propostas para hoje");
  });
  it("itemParaPriorizar pega o que fecha primeiro antes da disputa", () => {
    const itens = [item({ id: "a", dataEncerramento: depois(30 * HORA) }), item({ id: "b", dataEncerramento: depois(5 * HORA) }), item({ id: "c", etapa: "disputa", dataEncerramento: depois(1 * HORA) })];
    expect(itemParaPriorizar(itens, AGORA)?.id).toBe("b");
    expect(itemParaPriorizar([], AGORA)).toBeNull();
  });
  it("o dono vê o que a equipe fez com as propostas e as etapas com de/para", () => {
    const propostasMovidas = [
      { propostaId: "p1", objeto: "Toner", acao: "gerou" as const, porId: "paulo", porNome: "Paulo Henrique", total: 12_500 },
      { propostaId: "p2", objeto: "Papel", acao: "aprovou" as const, porId: "dono", porNome: "Dono", total: 800 },
    ];
    const r = textoResumoManha(dados({ usuarioId: "dono", escolhas: escolhasDoPerfil("acompanhamento"), propostasMovidas }), AGORA);
    expect(r.texto).toContain("📄 Propostas nas últimas 24 h: 1\n• Paulo gerou a proposta de Toner (R$ 12.500)");
    expect(r.texto).not.toContain("Papel");
  });
  it("botões do resumo: Gerar 1..3 com payload ger:, e Continuar só se sobrar lugar", () => {
    const tres = botoesDoResumoManha([{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }]);
    expect(tres).toEqual([
      { titulo: "Gerar 1", payload: "ger:a" },
      { titulo: "Gerar 2", payload: "ger:b" },
      { titulo: "Gerar 3", payload: "ger:c" },
    ]);
    const duas = botoesDoResumoManha([{ itemId: "a" }, { itemId: "b" }]);
    expect(duas.map((b) => b.titulo)).toEqual(["Gerar 1", "Gerar 2", "Continuar recebendo"]);
    expect(botoesDoResumoManha([]).map((b) => b.titulo)).toEqual(["Continuar recebendo"]);
  });
  it("comando gerar N e payload ger:/apr:", () => {
    expect(lerComando("gerar 1")).toEqual({ tipo: "gerar", numero: 1 });
    expect(lerComando("Gerar proposta 2!")).toEqual({ tipo: "gerar", numero: 2 });
    expect(lerComando("gerar")).toEqual({ tipo: "gerar", numero: null });
    expect(lerComando("gerar um relatório bonito").tipo).toBe("livre");
    expect(lerPayload("ger:12345678000190-1-000123/2025")).toEqual({ tipo: "gerar", itemId: "12345678000190-1-000123/2025" });
    expect(lerPayload(payloadDoBotao({ tipo: "aprovar", propostaId: "abc" }))).toEqual({ tipo: "aprovar", propostaId: "abc" });
    expect(payloadDoBotao({ tipo: "gerar", itemId: "x" })).toBe("ger:x");
  });
  it("saudações curtas viram comando local; 'continuar recebendo' segue como voltar", () => {
    for (const t of ["oi", "Olá!", "alô", "alo", "Bom dia", "boa tarde", "Boa noite", "ok"]) expect(lerComando(t)).toEqual({ tipo: "saudacao" });
    expect(lerComando("continuar recebendo")).toEqual({ tipo: "voltar" });
    expect(lerComando("oi, quanto custa o plano?").tipo).toBe("livre");
  });
  it("texto do rascunho pronto e aviso ao dono", () => {
    const texto = textoRascunhoPronto({ objeto: "Toner", total: 12_500, itens: 3, link: "https://x.test/propostas/p1", reaproveitado: false, podeAprovar: true });
    expect(texto).toContain("Rascunho pronto");
    expect(texto).toContain("Valor total: R$ 12.500 · 3 itens");
    expect(texto).toContain("https://x.test/propostas/p1");
    expect(texto).toContain("Revise e aprove pelo link");
    expect(textoRascunhoPronto({ objeto: "T", total: 1, itens: 1, link: "l", reaproveitado: true, podeAprovar: false })).toContain("já estava pronto");
    expect(textoAvisoAoDono({ nome: "Paulo Henrique", acao: "gerou", objeto: "Toner", total: 12_500, link: "https://x.test/p" })).toBe(
      "Paulo gerou a proposta de Toner (R$ 12.500): https://x.test/p",
    );
    expect(textoAvisoAoDono({ nome: "Paulo", acao: "aprovou", objeto: "Toner", total: 800, link: "l" })).toContain("Paulo aprovou a proposta de Toner (R$ 800)");
  });

  it("aviso de proposta que subiu, foi enviada ou registrada fora traz o link", () => {
    const subiu = textoAvisoAoDono({ nome: "Paulo Henrique", acao: "subiu", objeto: "Toner", total: 1_200, link: "https://x.test/p" });
    expect(subiu).toContain("Paulo subiu a proposta de Toner (R$ 1.200) para você revisar");
    expect(subiu).toContain("https://x.test/p");
    expect(subiu).toContain("*Aprovar*");
    const comLeitura = textoAvisoAoDono({ nome: "Paulo", acao: "subiu", objeto: "Toner", total: 1, link: "https://x.test/p", leitura: "https://x.test/p/abc" });
    expect(comLeitura).toContain("Ler o documento (abre sem login): https://x.test/p/abc");
    expect(comLeitura.indexOf("Ler o documento")).toBeLessThan(comLeitura.indexOf("Aprovar ou devolver"));
    expect(textoAvisoAoDono({ nome: "Paulo", acao: "enviou", objeto: "Toner", total: 0, link: "l" })).toBe(
      "📤 Paulo enviou no portal a proposta de Toner.\nComprovante e detalhes: l",
    );
    expect(textoAvisoAoDono({ nome: "", acao: "registrou", objeto: "Toner", total: 50, link: "l" })).toContain("Alguém da equipe registrou");
  });

  it("aviso de revisão ganha a linha de prejuízo ou de custo que falta", () => {
    const base = { nome: "Paulo", acao: "subiu" as const, objeto: "HD", total: 4_000, link: "https://x.test/p" };
    const prejuizo = textoAvisoAoDono({ ...base, custo: { prejuizo: 1_880, itensSemCusto: 2 } });
    expect(prejuizo.split("\n")[1]).toBe("⚠️ Prejuízo de R$ 1.880");
    expect(prejuizo).not.toContain("Custo não informado");
    expect(textoAvisoAoDono({ ...base, custo: { prejuizo: 0, itensSemCusto: 3 } }).split("\n")[1]).toBe("Custo não informado em 3 itens");
    expect(linhaAvisoCusto({ prejuizo: 0, itensSemCusto: 1 })).toBe("Custo não informado em 1 item");
    expect(textoAvisoAoDono({ ...base, acao: "gerou", custo: { prejuizo: 50, itensSemCusto: 0 } })).toBe(
      "Paulo gerou a proposta de HD (R$ 4.000): https://x.test/p\n⚠️ Prejuízo de R$ 50",
    );
    // sem problema de custo, o texto é o de sempre
    expect(textoAvisoAoDono({ ...base, custo: { prejuizo: 0, itensSemCusto: 0 } })).toBe(textoAvisoAoDono(base));
    expect(linhaAvisoCusto(null)).toBeNull();
    // outras ações não mudam
    expect(textoAvisoAoDono({ ...base, acao: "enviou", custo: { prejuizo: 9, itensSemCusto: 1 } })).toBe(textoAvisoAoDono({ ...base, acao: "enviou" }));
  });
});

describe("escolha entre texto e modelo", () => {
  it("janela aberta: texto completo, com ou sem modelos", () => {
    expect(escolherCanal(true, false)).toBe("texto");
    expect(escolherCanal(true, true)).toBe("texto");
  });
  it("janela fechada: modelo só com os modelos ligados", () => {
    expect(escolherCanal(false, true)).toBe("modelo");
    expect(escolherCanal(false, false)).toBe("nenhum");
  });
});

describe("parâmetros dos modelos", () => {
  it("sem quebra de linha, tab nem espaços repetidos, nunca vazio e até 180 caracteres", () => {
    expect(parametroDoModelo("a\nb\tc    d  e")).toBe("a b c d e");
    expect(parametroDoModelo("  \n ")).toBe("sem novidades");
    const longo = parametroDoModelo("palavra ".repeat(100));
    expect(longo.length).toBeLessThanOrEqual(180);
    expect(longo).not.toMatch(/\s{2,}|[\n\t]/);
  });
  it("nome do modelo é o primeiro nome, ou equipe", () => {
    expect(nomeParaModelo("Paulo Henrique")).toBe("Paulo");
    expect(nomeParaModelo("  ")).toBe("equipe");
  });
});

describe("linha curta do resumo das 7h", () => {
  // 7h em São Paulo
  const MANHA = new Date("2026-05-12T10:00:00Z");
  const item = (id: string, fim: string): ItemAlerta => ({ id, etapa: "cotando", objeto: id, dataEncerramento: fim, responsavelId: null });

  it("prazos de hoje, propostas, avisos e meta numa linha só", () => {
    const linha = linhaCurtaResumo(
      dados({
        itens: [item("a", "2026-05-12T18:00:00Z"), item("b", "2026-05-12T20:00:00Z"), item("c", "2026-05-12T21:00:00Z"), item("d", "2026-05-14T18:00:00Z")],
        propostasHoje: [
          { itemId: "a", objeto: "A", valor: 1, dataEncerramento: "2026-05-12T18:00:00Z" },
          { itemId: "b", objeto: "B", valor: 1, dataEncerramento: "2026-05-12T20:00:00Z" },
        ],
        pendencias: ["📝 Proposta para revisar"],
        disputasNaSemana: 2,
      }),
      MANHA,
    );
    expect(linha).toBe("3 prazos hoje, 2 propostas para fazer, 1 aviso, meta 2 de 5");
  });

  it("sem nada além da meta, só a meta; sem meta, sem pendências", () => {
    expect(linhaCurtaResumo(dados({ disputasNaSemana: 5 }), MANHA)).toBe("meta 5 de 10");
    expect(linhaCurtaResumo(dados({ escolhas: { ...escolhasDoPerfil("operacional"), meta: false } }), MANHA)).toBe("sem pendências hoje");
  });

  it("nunca passa de 180 caracteres nem leva quebra de linha", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => item(`i${i}`, "2026-05-12T18:00:00Z"));
    const linha = linhaCurtaResumo(dados({ itens: muitos, pendencias: Array.from({ length: 12 }, () => "x") }), MANHA);
    expect(linha.length).toBeLessThanOrEqual(180);
    expect(linha).not.toContain("\n");
  });
});

describe("andamento do dia (15h)", () => {
  // 15h em São Paulo
  const TARDE = new Date("2026-05-12T18:00:00Z");

  function prop(acao: MovimentoProposta["acao"], id: string): MovimentoProposta {
    return { propostaId: id, objeto: "Toner", acao, porId: "paulo", porNome: "Paulo Henrique", total: 1_000 };
  }

  function andamento(parcial: Partial<DadosAndamento> = {}): DadosAndamento {
    return {
      usuarioId: "ana",
      nome: "Ana Souza",
      escolhas: escolhasDoPerfil("operacional"),
      propostas: [],
      movimentos: [],
      semProposta: [],
      prazosPendentes: [],
      pendencias: [],
      emJogo: 3,
      disputasNaSemana: 2,
      vencidasNaSemana: { vencidas: 0, valor: 0, estimado: false },
      meta: { minimo: 5, ideal: 10 },
      ...parcial,
    };
  }

  it("início do dia é 0h em São Paulo", () => {
    expect(inicioDoDia(TARDE).toISOString()).toBe("2026-05-12T03:00:00.000Z");
  });

  it("propostas do dia, mudanças de etapa, o que fecha sem proposta e a meta, em linhas curtas", () => {
    const texto = textoAndamento(
      andamento({
        propostas: [prop("gerou", "p1"), prop("enviou", "p2"), prop("enviou", "p3"), prop("aprovou", "p4"), prop("devolveu", "p5")],
        movimentos: [
          { itemId: "i1", objeto: "Notebooks", de: "cotando", para: "proposta", porId: "paulo", porNome: "Paulo Henrique" },
          { itemId: "i1", objeto: "Notebooks", de: "proposta", para: "disputa", porId: "paulo", porNome: "Paulo Henrique" },
        ],
        semProposta: [{ itemId: "i2", objeto: "Papel A4", valor: 900, dataEncerramento: "2026-05-12T20:00:00Z" }],
      }),
      TARDE,
    );
    expect(texto.split("\n")).toEqual([
      "📊 Andamento do dia, Ana",
      "✅ Propostas hoje: 1 gerada, 1 aprovada, 2 enviadas, 1 devolvida",
      "✅ Mudaram de etapa: 1",
      "• Paulo: Notebooks (Cotando fornecedor → Proposta pronta)",
      "⚠️ Fecham hoje ou amanhã sem proposta: 1",
      "• Papel A4 (hoje às 17h)",
      "🎯 Meta: 2/5 disputas · faltam 3 até domingo",
    ]);
    expect(texto).not.toContain("\n\n");
  });

  it("dia parado com itens em jogo avisa com alerta; avisos e prazos da fila entram", () => {
    const texto = textoAndamento(
      andamento({
        pendencias: ["📝 Proposta para revisar\nhttps://x.test/p"],
        prazosPendentes: [{ id: "i3", etapa: "cotando", objeto: "Tinta", dataEncerramento: "2026-05-12T21:00:00Z", responsavelId: null }],
      }),
      TARDE,
    );
    expect(texto).toContain("⚠️ Nenhuma proposta mexida hoje");
    expect(texto).toContain("⚠️ Nenhum item mudou de etapa hoje");
    expect(texto).toContain("⏰ Prazos que ficaram sem aviso: 1\n• Tinta (em 3 h)");
    expect(texto).toContain("📌 Para você: 1\n• 📝 Proposta para revisar");
  });

  it("sem nada em jogo e nada acontecido, não há texto", () => {
    expect(textoAndamento(andamento({ emJogo: 0 }), TARDE)).toBe("");
  });

  it("linha curta do modelo: propostas, etapas, o que falta e a meta", () => {
    const linha = linhaCurtaAndamento(
      andamento({
        propostas: [prop("enviou", "p1"), prop("enviou", "p2"), prop("gerou", "p3")],
        movimentos: [{ itemId: "i1", objeto: "N", de: null, para: "proposta", porId: null, porNome: null }],
        semProposta: [
          { itemId: "a", objeto: "A", valor: null, dataEncerramento: "2026-05-12T20:00:00Z" },
          { itemId: "b", objeto: "B", valor: null, dataEncerramento: "2026-05-13T20:00:00Z" },
        ],
      }),
    );
    expect(linha).toBe("propostas: 1 gerada, 2 enviadas, 1 item mudou de etapa, 2 fecham hoje ou amanhã sem proposta, meta 2 de 5");
    expect(linha.length).toBeLessThanOrEqual(180);
    expect(linhaCurtaAndamento(andamento({ escolhas: { ...escolhasDoPerfil("operacional"), meta: false } }))).toBe("nenhuma proposta mexida");
  });
});
