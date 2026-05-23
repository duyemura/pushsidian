import "dotenv/config";
import { promises as fs } from "fs";
import { resolve } from "path";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "./types";

const MIGRATIONS_DIR = resolve(__dirname, "migrations");

async function migrate() {
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.execute(db);

  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrations = files.filter((f) => f.endsWith(".sql")).sort();

  for (const file of migrations) {
    const executed = await db
      .selectFrom("migrations")
      .select("name")
      .where("name", "=", file)
      .executeTakeFirst();

    if (executed) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const content = await fs.readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
    console.log(`Running ${file}`);
    await sql.raw(content).execute(db);
    await db.insertInto("migrations").values({ name: file, executed_at: new Date() }).execute();
  }

  console.log("Migrations complete");
  await db.destroy();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
