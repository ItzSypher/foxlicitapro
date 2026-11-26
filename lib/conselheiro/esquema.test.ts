import { describe, expect, it } from "vitest";
import { ESQUEMA_JSON_CONSELHEIRO, SaidaConselheiroSchema, lerSaidaConselheiro, type SaidaConselheiro } from "./esquema";

const SAIDA_EXEMPLO: SaidaConselheiro = {
  veredito: "nao-vale",
  condicao: "Vale se o lance ficar acima de R$ 1.055.",
  resumo: "Licenças de software por 24 meses. Dá para atender por revenda parceira, mas é pregão.",
  porQue: ["O objeto casa com os CNAEs de informática."],
  comoConseguir: [
    {
      canal: "Revenda parceira do fabricante",
      passos: ["Pedir cotação formal", "Confirmar prazo de ativação"],
      prazoTipico: "Ativação em poucos dias úteis",
      cuidados: ["Licença cobrada em dólar", "Nota fiscal de software"],
    },
  ],
  precoComentario: "O preço sugerido cabe no teto do órgão.",
  riscos: ["Variação do câmbio até o pagamento"],
  proximosPassos: ["Cotar com duas revendas"],
  modalidade: { ehPregao: true, foraDoFoco: true, observacao: "Pregão fica fora do foco atual." },
};

describe("SaidaConselheiroSchema", () => {
  it("aceita uma saída completa", () => {
    expect(SaidaConselheiroSchema.safeParse(SAIDA_EXEMPLO).success).toBe(true);
    expect(lerSaidaConselheiro(SAIDA_EXEMPLO)).toEqual(SAIDA_EXEMPLO);
  });

  it("recusa veredito desconhecido, listas vazias e texto vazio", () => {
    expect(SaidaConselheiroSchema.safeParse({ ...SAIDA_EXEMPLO, veredito: "sim" }).success).toBe(false);
    expect(SaidaConselheiroSchema.safeParse({ ...SAIDA_EXEMPLO, porQue: [] }).success).toBe(false);
    expect(SaidaConselheiroSchema.safeParse({ ...SAIDA_EXEMPLO, comoConseguir: [] }).success).toBe(false);
    expect(SaidaConselheiroSchema.safeParse({ ...SAIDA_EXEMPLO, resumo: "  " }).success).toBe(false);
  });

  it("recusa modalidade incompleta e devolve null ao ler lixo do banco", () => {
    expect(SaidaConselheiroSchema.safeParse({ ...SAIDA_EXEMPLO, modalidade: { ehPregao: true } }).success).toBe(false);
    expect(lerSaidaConselheiro({ qualquer: "coisa" })).toBeNull();
    expect(lerSaidaConselheiro(null)).toBeNull();
  });

  it("não tem campo numérico de preço, nem no zod nem no JSON Schema", () => {
    const props = ESQUEMA_JSON_CONSELHEIRO.properties as Record<string, { type?: unknown }>;
    expect(Object.values(props).some((p) => p.type === "number" || p.type === "integer")).toBe(false);
    expect(Object.keys(SaidaConselheiroSchema.shape)).not.toContain("preco");
  });

  it("o JSON Schema pede os mesmos campos do zod", () => {
    expect([...(ESQUEMA_JSON_CONSELHEIRO.required as string[])].sort()).toEqual(Object.keys(SaidaConselheiroSchema.shape).sort());
  });
});
