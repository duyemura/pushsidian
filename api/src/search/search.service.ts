import { getDB } from "../db";
import { sql } from "kysely";

export class SearchService {
  async getAccessibleDocIds(userId: string, orgId: string) {
    const db = getDB();
    const result = await db
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
      .select("documents.id")
      .distinct()
      .execute();

    return result.map((r) => r.id);
  }

  async semanticSearch(query: string, userId: string, orgId: string, limit: number = 10) {
    // Phase 1: return empty results. In production, generate embedding via OpenAI and query pgvector.
    const accessibleIds = await this.getAccessibleDocIds(userId, orgId);
    if (accessibleIds.length === 0) return [];

    // TODO: call OpenAI to generate embedding for query, then:
    // SELECT dc.*, dc.embedding <=> $embedding AS distance
    // FROM document_chunks dc
    // WHERE dc.document_id = ANY($1)
    // ORDER BY distance
    // LIMIT $2

    return [];
  }

  async fullTextSearch(query: string, userId: string, orgId: string, limit: number = 20) {
    const db = getDB();
    const accessibleIds = await this.getAccessibleDocIds(userId, orgId);
    if (accessibleIds.length === 0) return [];

    // Simple ILIKE search on chunks
    const chunks = await db
      .selectFrom("document_chunks")
      .innerJoin("documents", "document_chunks.document_id", "documents.id")
      .where("documents.id", "in", accessibleIds)
      .where("document_chunks.chunk_text", "ilike", `%${query}%`)
      .select([
        "document_chunks.document_id",
        "document_chunks.chunk_text",
        "document_chunks.chunk_index",
        "documents.obsidian_path",
        "documents.title",
      ])
      .limit(limit)
      .execute();

    return chunks.map((c) => ({
      document_id: c.document_id,
      obsidian_path: c.obsidian_path,
      title: c.title,
      chunk_text: c.chunk_text,
      chunk_index: c.chunk_index,
    }));
  }

  async getContextForPrompt(query: string, userId: string, orgId: string, limit: number = 10) {
    // Phase 1: use full-text search as fallback for semantic
    return this.fullTextSearch(query, userId, orgId, limit);
  }
}
