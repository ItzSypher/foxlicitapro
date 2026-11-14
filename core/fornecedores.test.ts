import { describe, expect, it } from "vitest";
import {
  DadosFornecedorSchema,
  agruparPrecosPorItem,
  filtrarFornecedores,
  sugerirPrecos,
  type Fornecedor,
  type PrecoFornecedor,
} from "./fornecedores";
import { normalizarTexto, palavrasDe } from "./texto-busca";

function preco(parcial: Partial<PrecoFornecedor>): PrecoFornecedor {
  return {
    id: "p1",
    fornecedorId: "f1",
    fornecedorNome: "Alfa",
    descricao: "Monitor LED 24 polegadas",
    unidade: "un",
    preco: 700,
    prazoDias: 5,
    data: "2026-10-01",
    origem: "manual",
    ...parcial,
  };
}

describe("texto de busca", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizarTexto("  Câmera de Segurança, 1080P! ")).toBe("camera de seguranca 1080p");
  });

  it("ignora palavras curtas e conectivos, sem repetir", () => {
    expect(palavrasDe("Cabo de rede para o PC com 5 metros cabo")).toEqual(["cabo", "rede", "metros"]);
  });
});

describe("sugerirPrecos", () => {
  const precos = [
    preco({ id: "a", descricao: "Monitor LED 24 polegadas", preco: 700, data: "2026-10-01", fornecedorNome: "Alfa" }),
    preco({ id: "b", descricao: "Monitor 24 polegadas Full HD", preco: 650, data: "2026-09-01", fornecedorNome: "Beta" }),
    preco({ id: "c", descricao: "Monitor 24 polegadas", preco: 720, data: "2026-11-01", fornecedorNome: "Gama" }),
    preco({ id: "d", descricao: "Teclado sem fio", preco: 90, data: "2026-11-02" }),
  ];

  it("acha itens parecidos sem acento e devolve o último e o menor preço", () => {
    const s = sugerirPrecos("MONITOR 24 Polegadas", precos);
    expect(s?.total).toBe(3);
    expect(s?.ultimo.id).toBe("c");
    expect(s?.menor.id).toBe("b");
  });

  it("não sugere para item sem relação ou descrição sem palavra útil", () => {
    expect(sugerirPrecos("Cadeira giratória", precos)).toBeNull();
    expect(sugerirPrecos("de a", precos)).toBeNull();
    expect(sugerirPrecos("monitor", [])).toBeNull();
  });

  it("com várias palavras, exige pelo menos metade delas", () => {
    expect(sugerirPrecos("teclado mouse headset webcam", precos)).toBeNull();
    expect(sugerirPrecos("teclado mouse", precos)?.ultimo.id).toBe("d");
  });
});

describe("agruparPrecosPorItem", () => {
  it("agrupa por descrição normalizada com média, menor, maior e último", () => {
    const itens = agruparPrecosPorItem([
      preco({ id: "1", descricao: "Cabo HDMI 2m", preco: 20, data: "2026-09-01" }),
      preco({ id: "2", descricao: "cabo hdmi 2m", preco: 30, data: "2026-10-01" }),
      preco({ id: "3", descricao: "Switch 8 portas", preco: 100, data: "2026-10-02" }),
    ]);
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ descricao: "cabo hdmi 2m", quantidade: 2, media: 25, menor: 20, maior: 30, ultimo: 30 });
  });
});

describe("filtrarFornecedores e cadastro", () => {
  const base: Omit<Fornecedor, "id" | "nome"> = {
    cnpj: null,
    contato: "",
    telefone: "",
    email: "",
    site: "",
    categorias: "",
    observacao: "",
    ativo: true,
  };
  const lista: Fornecedor[] = [
    { ...base, id: "1", nome: "Distribuidora Alfa", categorias: "informática, monitores" },
    { ...base, id: "2", nome: "Elétrica Beta", categorias: "material elétrico" },
  ];

  it("busca sem acento em nome e categorias", () => {
    expect(filtrarFornecedores(lista, "eletrica").map((f) => f.id)).toEqual(["2"]);
    expect(filtrarFornecedores(lista, "informatica monitores").map((f) => f.id)).toEqual(["1"]);
    expect(filtrarFornecedores(lista, "").length).toBe(2);
  });

  it("valida o cadastro: CNPJ opcional, mas correto quando informado", () => {
    const ok = DadosFornecedorSchema.safeParse({ ...base, nome: " Alfa ", cnpj: "" });
    expect(ok.success && ok.data.cnpj).toBeNull();
    expect(ok.success && ok.data.nome).toBe("Alfa");
    expect(DadosFornecedorSchema.safeParse({ ...base, nome: "Alfa", cnpj: "11.111.111/1111-11" }).success).toBe(false);
    const valido = DadosFornecedorSchema.safeParse({ ...base, nome: "Alfa", cnpj: "70.048.886/0001-29" });
    expect(valido.success && valido.data.cnpj).toBe("70048886000129");
    expect(DadosFornecedorSchema.safeParse({ ...base, nome: "" }).success).toBe(false);
  });
});
