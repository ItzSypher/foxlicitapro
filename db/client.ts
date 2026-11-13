import "server-only";
import postgres from "postgres";

/**
 * Conexão única com o Postgres do Supabase pelo pooler em modo transação (porta 6543).
 * `prepare: false` é obrigatório nesse modo. Só pode ser importado no servidor.
 * A conexão é criada no primeiro uso, não ao importar: o build não precisa de DATABASE_URL.
 *
 * Na Vercel a instância congela entre pedidos e o pooler pode derrubar o socket nesse tempo;
 * o postgres.js não percebe e a consulta seguinte espera para sempre. Por isso:
 * - depois de um intervalo sem uso, a conexão antiga é descartada e outra é aberta;
 * - conexões ociosas fecham rápido e nenhuma vive mais de 5 minutos;
 * - o banco cancela qualquer comando que passe de 20 s.
 */
declare global {
  var __foxSql: postgres.Sql | undefined;
  var __foxSqlUsoEm: number | undefined;
}

/** Sem uso por mais que isso, a conexão pode estar morta: abre outra. */
const RENOVAR_APOS_MS = 30_000;

function criar(url: string): postgres.Sql {
  return postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 5,
    max_lifetime: 60 * 5,
    connect_timeout: 8,
    ssl: "require",
    connection: { statement_timeout: 20_000 },
  });
}

function obter(): postgres.Sql {
  const agora = Date.now();
  const anterior = globalThis.__foxSql;
  const parado = globalThis.__foxSqlUsoEm !== undefined && agora - globalThis.__foxSqlUsoEm > RENOVAR_APOS_MS;
  globalThis.__foxSqlUsoEm = agora;
  if (anterior && !parado) return anterior;

  if (anterior) {
    globalThis.__foxSql = undefined;
    anterior.end({ timeout: 5 }).catch(() => undefined);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const criado = criar(url);
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
