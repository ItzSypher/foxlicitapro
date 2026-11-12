import "server-only";
import postgres from "postgres";

/**
 * Conexão única com o Postgres do Supabase pelo pooler em modo transação (porta 6543).
 * `prepare: false` é obrigatório nesse modo. Só pode ser importado no servidor.
 */
declare global {
  var __foxSql: postgres.Sql | undefined;
}

function criar(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  return postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ssl: "require" });
}

export const sql: postgres.Sql = globalThis.__foxSql ?? criar();
if (process.env.NODE_ENV !== "production") globalThis.__foxSql = sql;
