import { getDB } from "../db";
import { uploadDocument } from "../s3";

export class DocumentService {
  async listAccessible(userId: string, orgId: string, ownerId?: string) {
    const db = getDB();

    let query = db
      .selectFrom("documents")
      .leftJoin("document_rules", "documents.id", "document_rules.document_id")
      .leftJoin("group_memberships", "document_rules.subject_id", "group_memberships.group_id")
      .where("documents.org_id", "=", orgId)
      .where("documents.is_deleted", "=", false)
      .where((eb) =>
        eb.or([
          eb("document_rules.subject_id", "=", userId),
          eb("group_memberships.user_id", "=", userId),
          eb("documents.owner_id", "=", userId),
        ])
      );

    if (ownerId) {
      query = query.where("documents.owner_id", "=", ownerId);
    }

    const docs = await query.selectAll("documents").distinct().execute();
    return docs;
  }

  async create(data: {
    org_id: string;
    owner_id: string;
    s3_key: string;
    vault_id: string;
    obsidian_path: string;
    title: string | null;
    content_hash: string;
  }) {
    const db = getDB();
    const doc = await db
      .insertInto("documents")
      .values({
        ...data,
        id: crypto.randomUUID(),
        version: 1,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return doc;
  }

  async getById(id: string) {
    const db = getDB();
    return db.selectFrom("documents").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async setRules(
    documentId: string,
    rules: { subject_id: string; relation: string }[],
    grantedBy: string,
    orgId: string
  ) {
    const db = getDB();

    // Resolve slugs like "everyone" to actual group IDs
    const resolved = await Promise.all(
      rules.map(async (r) => {
        // User IDs
        if (r.subject_id.startsWith("user_")) {
          return r;
        }
        // Group IDs: grp_ prefix or raw UUID (backward compat)
        if (r.subject_id.startsWith("grp_") || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.subject_id)) {
          return r;
        }
        // Try resolving as a group slug in this org
        const group = await db
          .selectFrom("groups")
          .select("id")
          .where("org_id", "=", orgId)
          .where("slug", "=", r.subject_id)
          .executeTakeFirst();
        if (group) {
          return { ...r, subject_id: group.id };
        }
        console.warn(`[Pushsidian] Could not resolve share rule for subject_id: ${r.subject_id}`);
        return null;
      })
    );

    const validRules = resolved.filter(Boolean) as { subject_id: string; relation: string }[];

    await db.deleteFrom("document_rules").where("document_id", "=", documentId).execute();
    if (validRules.length === 0) return;
    await db
      .insertInto("document_rules")
      .values(
        validRules.map((r) => ({
          document_id: documentId,
          subject_id: r.subject_id,
          relation: r.relation as "reader" | "writer" | "owner",
          granted_by: grantedBy,
          granted_at: new Date(),
        }))
      )
      .execute();
  }

  async upsertWithContent(data: {
    org_id: string;
    owner_id: string;
    vault_id: string;
    obsidian_path: string;
    title: string | null;
    content: string;
    content_hash: string;
    rules: { subject_id: string; relation: string }[];
  }) {
    const db = getDB();
    const existing = await db
      .selectFrom("documents")
      .selectAll()
      .where("org_id", "=", data.org_id)
      .where("vault_id", "=", data.vault_id)
      .where("obsidian_path", "=", data.obsidian_path)
      .where("owner_id", "=", data.owner_id)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("documents")
        .set({
          content_hash: data.content_hash,
          title: data.title,
          version: existing.version + 1,
          updated_at: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();

      await uploadDocument(existing.s3_key, data.content);
      await this.setRules(existing.id, data.rules, data.owner_id, data.org_id);
      await db.deleteFrom("document_chunks").where("document_id", "=", existing.id).execute();

      return existing.id;
    }

    const s3Key = `org_${data.org_id}/${data.vault_id}/${Buffer.from(data.obsidian_path).toString("base64url")}.md`;
    const doc = await this.create({
      org_id: data.org_id,
      owner_id: data.owner_id,
      s3_key: s3Key,
      vault_id: data.vault_id,
      obsidian_path: data.obsidian_path,
      title: data.title,
      content_hash: data.content_hash,
    });

    await uploadDocument(s3Key, data.content);
    await this.setRules(doc.id, data.rules, data.owner_id, data.org_id);

    return doc.id;
  }

  async getRules(documentId: string) {
    const db = getDB();
    return db
      .selectFrom("document_rules")
      .selectAll()
      .where("document_id", "=", documentId)
      .execute();
  }

  async canAccess(userId: string, documentId: string) {
    const db = getDB();
    const accessible = await db
      .selectFrom("documents")
      .leftJoin("document_rules", "documents.id", "document_rules.document_id")
      .leftJoin("group_memberships", "document_rules.subject_id", "group_memberships.group_id")
      .where("documents.id", "=", documentId)
      .where("documents.is_deleted", "=", false)
      .where((eb) =>
        eb.or([
          eb("document_rules.subject_id", "=", userId),
          eb("group_memberships.user_id", "=", userId),
          eb("documents.owner_id", "=", userId),
        ])
      )
      .select("documents.id")
      .distinct()
      .executeTakeFirst();
    return !!accessible;
  }
}
