import { getDB } from "../db";

export class DocumentService {
  async listAccessible(userId: string, orgId: string) {
    const db = getDB();

    const docs = await db
      .selectFrom("documents")
      .innerJoin("document_rules", "documents.id", "document_rules.document_id")
      .leftJoin("group_memberships", "document_rules.subject_id", "group_memberships.group_id")
      .where("documents.org_id", "=", orgId)
      .where("documents.is_deleted", "=", false)
      .where((eb) =>
        eb.or([
          eb("document_rules.subject_id", "=", userId),
          eb("group_memberships.user_id", "=", userId),
        ])
      )
      .selectAll("documents")
      .distinct()
      .execute();

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
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
    return doc;
  }

  async getById(id: string) {
    const db = getDB();
    return db.selectFrom("documents").selectAll().where("id", "=", id).executeTakeFirst();
  }
}
