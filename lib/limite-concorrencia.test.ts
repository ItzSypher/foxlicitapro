import { describe, expect, it } from "vitest";
import { criarFila } from "./limite-concorrencia";

function adiavel<T>(): { promessa: Promise<T>; resolver: (v: T) => void } {
  let resolver: (v: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

describe("criarFila", () => {
  it("nunca roda mais tarefas que o limite e mantém a ordem de chegada", async () => {
    const daFila = criarFila(2);
    const ordem: number[] = [];
    let simultaneas = 0;
    let maximo = 0;
    const portas = [adiavel<void>(), adiavel<void>(), adiavel<void>(), adiavel<void>()];

    const tarefas = portas.map((porta, i) =>
      daFila(async () => {
        ordem.push(i);
        simultaneas += 1;
        maximo = Math.max(maximo, simultaneas);
        await porta.promessa;
        simultaneas -= 1;
        return i;
      }),
    );

    await Promise.resolve();
    expect(ordem).toEqual([0, 1]);
    portas[0].resolver();
    await tarefas[0];
    await Promise.resolve();
    expect(ordem).toEqual([0, 1, 2]);
    portas[1].resolver();
    portas[2].resolver();
    portas[3].resolver();
    expect(await Promise.all(tarefas)).toEqual([0, 1, 2, 3]);
    expect(maximo).toBe(2);
  });

  it("libera a vaga quando a tarefa falha", async () => {
    const daFila = criarFila(1);
    await expect(daFila(() => Promise.reject(new Error("falhou")))).rejects.toThrow("falhou");
    await expect(daFila(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});
