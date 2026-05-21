import { getDB } from "../db";

export class OrgService {
  async create(data: {
    slug: string;
    display_name: string;
    owner_id: string;
  }) {
    const db = getDB();
    const org = await db
      .insertInto("organizations")
      .values({
        ...data,
        id: crypto.randomUUID(),
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .insertInto("groups")
      .values([
        { id: crypto.randomUUID(), org_id: org.id, display_name: "Everyone", slug: "everyone", created_at: new Date() },
        { id: crypto.randomUUID(), org_id: org.id, display_name: "Admin", slug: "admin", created_at: new Date() },
      ])
      .execute();

    await db
      .insertInto("org_memberships")
      .values({
        id: crypto.randomUUID(),
        org_id: org.id,
        user_id: data.owner_id,
        role: "owner",
        created_at: new Date(),
      })
      .execute();

    return org;
  }

  async getById(id: string) {
    const db = getDB();
    return db.selectFrom("organizations").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async getBySlug(slug: string) {
    const db = getDB();
    return db.selectFrom("organizations").selectAll().where("slug", "=", slug).executeTakeFirst();
  }

  async listMembers(orgId: string) {
    const db = getDB();
    return db
      .selectFrom("org_memberships")
      .innerJoin("subjects", "org_memberships.user_id", "subjects.id")
      .where("org_memberships.org_id", "=", orgId)
      .select([
        "subjects.id",
        "subjects.display_name",
        "subjects.email",
        "org_memberships.role",
        "org_memberships.created_at",
      ])
      .execute();
  }

  async createGroup(orgId: string, displayName: string, slug: string) {
    const db = getDB();
    return db
      .insertInto("groups")
      .values({ id: crypto.randomUUID(), org_id: orgId, display_name: displayName, slug, created_at: new Date() })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listGroups(orgId: string) {
    const db = getDB();
    return db.selectFrom("groups").selectAll().where("org_id", "=", orgId).execute();
  }
}
