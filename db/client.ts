import "server-only";
import postgres from "postgres";

/**
 * Conexão única com o Postgres do Supabase pelo pooler em modo transação (porta 6543).
 * `prepare: false` é obrigatório nesse modo. Só pode ser importado no servidor.
 * A conexão é criada no primeiro uso, não ao importar: o build não precisa de DATABASE_URL.
 */
declare global {
  var __foxSql: postgres.Sql | undefined;
}

function obter(): postgres.Sql {
  if (globalThis.__foxSql) return globalThis.__foxSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const criado = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ssl: "require" });
  globalThis.__foxSql = criado;
  return criado;
}

export const sql: postgres.Sql = new Proxy((() => undefined) as unknown as postgres.Sql, {
  apply(_alvo, esse, argumentos: unknown[]) {
    return Reflect.apply(obter() as unknown as (...a: unknown[]) => unknown, esse, argumentos);
  },
  get(_alvo, propriedade) {
    const real = obter();
    const valor: unknown = Reflect.get(real, propriedade, real);
    return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(real) : valor;
  },
});
