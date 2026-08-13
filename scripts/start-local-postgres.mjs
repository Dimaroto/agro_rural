import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = join(process.cwd(), ".postgres-data");
const port = Number(process.env.POSTGRES_PORT || 5432);
const user = process.env.POSTGRES_USER || "catalogo";
const password = process.env.POSTGRES_PASSWORD || "catalogo";
const database = process.env.POSTGRES_DB || "catalogo";

await mkdir(databaseDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
});

await pg.initialise();
await pg.start();

try {
  await pg.createDatabase(database);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!/already exists/i.test(message)) {
    throw err;
  }
}

console.log(`Postgres local em postgresql://${user}@127.0.0.1:${port}/${database}`);

function shutdown() {
  pg.stop()
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {});
