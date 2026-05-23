import { getDB } from "../db";

export class ApiKeyService {
  async create(data: { user_id: string; org_id: string; label?: string }) {
    const db = getDB();
    const rawKey = `psk_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = await this.hashKey(rawKey);

    await db
      .insertInto("api_keys")
      .values({
        id: crypto.randomUUID(),
        user_id: data.user_id,
        org_id: data.org_id,
        key_hash: keyHash,
        label: data.label ?? null,
        created_at: new Date(),
      })
      .execute();

    return { rawKey, keyHash };
  }

  async listForUser(userId: string) {
    const db = getDB();
    return db
      .selectFrom("api_keys")
      .innerJoin("organizations", "api_keys.org_id", "organizations.id")
      .where("api_keys.user_id", "=", userId)
      .select([
        "api_keys.id",
        "api_keys.label",
        "api_keys.created_at",
        "api_keys.last_used_at",
        "organizations.display_name as org_name",
      ])
      .orderBy("api_keys.created_at", "desc")
      .execute();
  }

  async revoke(keyId: string, userId: string) {
    const db = getDB();
    return db
      .deleteFrom("api_keys")
      .where("id", "=", keyId)
      .where("user_id", "=", userId)
      .execute();
  }

  async verify(rawKey: string): Promise<{ userId: string; orgId: string } | null> {
    const keyHash = await this.hashKey(rawKey);
    const db = getDB();
    const row = await db
      .selectFrom("api_keys")
      .select(["user_id", "org_id"])
      .where("key_hash", "=", keyHash)
      .executeTakeFirst();

    if (!row) return null;

    await db
      .updateTable("api_keys")
      .set({ last_used_at: new Date() })
      .where("key_hash", "=", keyHash)
      .execute();

    return { userId: row.user_id, orgId: row.org_id };
  }

  private async hashKey(key: string): Promise<string> {
    const buf = new TextEncoder().encode(key);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
