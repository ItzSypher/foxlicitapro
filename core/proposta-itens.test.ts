import { describe, expect, it } from "vitest";
import { acrescentarItem, alterarItem, moverItem, proximaChave, removerItem } from "./proposta-itens";

interface Linha {
  chave: number;
  nome: string;
}

const base: Linha[] = [
  { chave: 1, nome: "a" },
  { chave: 5, nome: "b" },
  { chave: 3, nome: "c" },
];

describe("itens da proposta", () => {
  it("calcula a próxima chave sem repetir nenhuma", () => {
    expect(proximaChave(base)).toBe(6);
    expect(proximaChave([])).toBe(1);
  });

  it("altera só o item da chave e não muda a lista original", () => {
    const novo = alterarItem(base, 5, { nome: "x" });
    expect(novo.map((i) => i.nome)).toEqual(["a", "x", "c"]);
    expect(base[1].nome).toBe("b");
  });

  it("remove pela chave", () => {
    expect(removerItem(base, 1).map((i) => i.chave)).toEqual([5, 3]);
    expect(removerItem(base, 99)).toHaveLength(3);
  });

  it("acrescenta no fim com chave nova", () => {
    const novo = acrescentarItem(base, (chave) => ({ chave, nome: "" }));
    expect(novo).toHaveLength(4);
    expect(novo[3].chave).toBe(6);
  });

  it("move para cima e para baixo e respeita as pontas", () => {
    expect(moverItem(base, 0, 1).map((i) => i.nome)).toEqual(["b", "a", "c"]);
    expect(moverItem(base, 2, -1).map((i) => i.nome)).toEqual(["a", "c", "b"]);
    expect(moverItem(base, 0, -1).map((i) => i.nome)).toEqual(["a", "b", "c"]);
    expect(moverItem(base, 2, 1).map((i) => i.nome)).toEqual(["a", "b", "c"]);
  });
});
