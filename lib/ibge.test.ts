import { describe, expect, it, vi } from "vitest";
import { lerMunicipiosIbge, listarMunicipios } from "./ibge";

describe("lerMunicipiosIbge", () => {
  it("converte, ordena e descarta o que está fora do padrão", () => {
    expect(
      lerMunicipiosIbge([{ id: 3550308, nome: "São Paulo" }, { id: 3500105, nome: "Adamantina" }, { lixo: 1 }]),
    ).toEqual([
      { codigo: "3500105", nome: "Adamantina" },
      { codigo: "3550308", nome: "São Paulo" },
    ]);
    expect(lerMunicipiosIbge({ erro: true })).toEqual([]);
  });
});

describe("listarMunicipios", () => {
  it("não chama o IBGE para UF inexistente", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("[]"));
    expect(await listarMunicipios("XX", fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("pede os municípios da UF e devolve null se o IBGE falhar", async () => {
    const bom = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify([{ id: 3106200, nome: "Belo Horizonte" }])),
    );
    expect(await listarMunicipios("mg", bom)).toEqual([{ codigo: "3106200", nome: "Belo Horizonte" }]);
    expect(String(bom.mock.calls[0]?.[0])).toBe(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/MG/municipios",
    );

    const ruim = vi.fn<typeof fetch>(async () => new Response("erro", { status: 500 }));
    expect(await listarMunicipios("MG", ruim)).toBeNull();
  });
});
