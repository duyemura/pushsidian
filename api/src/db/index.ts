import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "./types";

let db: Kysely<DB> | null = null;

export function getDB(): Kysely<DB> {
  if (!db) {
    db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
        }),
      }),
    });
  }
  return db;
}
