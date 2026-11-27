/**
 * Fila que deixa no máximo `limite` tarefas rodando ao mesmo tempo, na ordem em que chegaram.
 * Serve para as consultas ao banco de um pedido: o pool de produção tem poucas conexões por instância.
 * A tarefa não pode esperar outra tarefa da mesma fila (travaria).
 */
export type DaFila = <T>(tarefa: () => Promise<T>) => Promise<T>;

export function criarFila(limite: number): DaFila {
  let rodando = 0;
  const espera: Array<() => void> = [];

  /** Passa a vaga direto para quem espera; sem ninguém na fila, a vaga volta. */
  const liberar = (): void => {
    const proximo = espera.shift();
    if (proximo) proximo();
    else rodando -= 1;
  };

  return async <T>(tarefa: () => Promise<T>): Promise<T> => {
    if (rodando < limite) rodando += 1;
    else await new Promise<void>((retomar) => espera.push(retomar));
    try {
      return await tarefa();
    } finally {
      liberar();
    }
  };
}
