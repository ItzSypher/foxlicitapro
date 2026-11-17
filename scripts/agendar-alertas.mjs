// Agenda no Supabase (pg_cron + pg_net) a chamada de hora em hora da rota de alertas de WhatsApp,
// das 7h às 20h em São Paulo (10h às 23h UTC). O segredo fica no cofre do banco (Vault), nunca no código.
// Uso: node scripts/agendar-alertas.mjs <arquivo-com-o-segredo> [url-base]
// O arquivo deve ter o mesmo valor de ALERTAS_CRON_SECRET do Vercel. Lê DATABASE_URL de .env.local ou do ambiente.
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL;
const arquivo = process.argv[2];
const base = (process.argv[3] ?? "https://licitapro.foxtisolutions.com.br").replace(/\/+$/, "");
if (!url || !arquivo) {
  console.error("Uso: node scripts/agendar-alertas.mjs <arquivo-com-o-segredo> [url-base]");
  process.exit(1);
}
const segredo = readFileSync(arquivo, "utf8").trim();
if (segredo.length < 32) {
  console.error("segredo curto demais");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, ssl: "require", onnotice: () => {} });
const NOME = "alertas_cron_secret";
const JOB = "foxlicita-alertas-whatsapp";
const comando = `select net.http_get(
  url := '${base}/api/cron/alertas',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${NOME}')),
  timeout_milliseconds := 30000
);`;

try {
  await sql`create extension if not exists pg_cron`;
  await sql`create extension if not exists pg_net`;
  const existente = await sql`select id from vault.secrets where name = ${NOME}`;
  if (existente.length > 0) await sql`select vault.update_secret(${existente[0].id}, ${segredo})`;
  else await sql`select vault.create_secret(${segredo}, ${NOME})`;
  await sql`select cron.schedule(${JOB}, '0 10-23 * * *', ${comando})`;
  const [job] = await sql`select jobname, schedule from cron.job where jobname = ${JOB}`;
  console.log("agendado", job?.jobname, job?.schedule);
} finally {
  await sql.end();
}
