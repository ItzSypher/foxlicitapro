// Aplica as migrações de db/migrations em ordem, uma única vez cada.
// Uso: npm run db:migrar  (lê DATABASE_URL de .env.local ou do ambiente)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, ssl: "require", onnotice: () => {} });
const pasta = join("db", "migrations");

try {
  await sql`create table if not exists _migracoes (nome text primary key, aplicada_em timestamptz not null default now())`;
  const feitas = new Set((await sql`select nome from _migracoes`).map((l) => l.nome));
  for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith(".sql")).sort()) {
    if (feitas.has(arquivo)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(pasta, arquivo), "utf8"));
      await tx`insert into _migracoes (nome) values (${arquivo})`;
    });
    console.log("aplicada", arquivo);
  }
  console.log("banco em dia");
} finally {
  await sql.end();
}
