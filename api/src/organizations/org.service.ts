import { getDB } from "../db";

export class OrgService {
  async createOrAttach(data: {
    slug: string;
    display_name: string;
    owner_id: string;
  }) {
    const db = getDB();

    // If org already exists, ensure caller is attached as owner
    const existing = await this.getBySlug(data.slug);
    if (existing) {
      const membership = await db
        .selectFrom("org_memberships")
        .selectAll()
        .where("org_id", "=", existing.id)
        .where("user_id", "=", data.owner_id)
        .executeTakeFirst();

      if (!membership) {
        await db
          .insertInto("org_memberships")
          .values({
            id: crypto.randomUUID(),
            org_id: existing.id,
            user_id: data.owner_id,
            role: "owner",
            created_at: new Date(),
          })
          .execute();
      }

      // Ensure user is in the Everyone group for this org
      const everyoneGroup = await db
        .selectFrom("groups")
        .select("id")
        .where("org_id", "=", existing.id)
        .where("slug", "=", "everyone")
        .executeTakeFirst();

      if (everyoneGroup) {
        const alreadyInGroup = await db
          .selectFrom("group_memberships")
          .selectAll()
          .where("group_id", "=", everyoneGroup.id)
          .where("user_id", "=", data.owner_id)
          .executeTakeFirst();

        if (!alreadyInGroup) {
          await db
            .insertInto("group_memberships")
            .values({ group_id: everyoneGroup.id, user_id: data.owner_id })
            .execute();
        }
      }

      return existing;
    }

    // Create new org atomically
    return db.transaction().execute(async (trx) => {
      const org = await trx
        .insertInto("organizations")
        .values({
          ...data,
          id: crypto.randomUUID(),
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const everyoneId = `grp_${crypto.randomUUID()}`;
      const adminId = `grp_${crypto.randomUUID()}`;

      await trx
        .insertInto("groups")
        .values([
          { id: everyoneId, org_id: org.id, display_name: "Everyone", slug: "everyone", created_at: new Date() },
          { id: adminId, org_id: org.id, display_name: "Admin", slug: "admin", created_at: new Date() },
        ])
        .execute();

      await trx
        .insertInto("subjects")
        .values([
          { id: everyoneId, type: "group", clerk_id: null, email: null, display_name: "Everyone", avatar_url: null, created_at: new Date() },
          { id: adminId, type: "group", clerk_id: null, email: null, display_name: "Admin", avatar_url: null, created_at: new Date() },
        ])
        .execute();

      await trx
        .insertInto("org_memberships")
        .values({
          id: crypto.randomUUID(),
          org_id: org.id,
          user_id: data.owner_id,
          role: "owner",
          created_at: new Date(),
        })
        .execute();

      // Add owner to default groups
      await trx
        .insertInto("group_memberships")
        .values([
          { group_id: everyoneId, user_id: data.owner_id },
          { group_id: adminId, user_id: data.owner_id },
        ])
        .execute();

      return org;
    });
  }

  async getById(id: string) {
    const db = getDB();
    return db.selectFrom("organizations").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async getBySlug(slug: string) {
    const db = getDB();
    return db.selectFrom("organizations").selectAll().where("slug", "=", slug).executeTakeFirst();
  }

  async listForUser(userId: string) {
    const db = getDB();
    return db
      .selectFrom("org_memberships")
      .innerJoin("organizations", "org_memberships.org_id", "organizations.id")
      .where("org_memberships.user_id", "=", userId)
      .select([
        "organizations.id",
        "organizations.slug",
        "organizations.display_name",
        "organizations.owner_id",
        "organizations.created_at",
        "org_memberships.role",
      ])
      .execute();
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
        "subjects.slack_handle",
        "subjects.email",
        "org_memberships.role",
        "org_memberships.created_at",
      ])
      .execute();
  }

  async createGroup(orgId: string, displayName: string, slug: string) {
    const db = getDB();
    const id = `grp_${crypto.randomUUID()}`;
    await db
      .insertInto("groups")
      .values({ id, org_id: orgId, display_name: displayName, slug, created_at: new Date() })
      .execute();
    await db
      .insertInto("subjects")
      .values({ id, type: "group", clerk_id: null, email: null, display_name: displayName, avatar_url: null, created_at: new Date() })
      .execute();
    return db.selectFrom("groups").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  }

  async listGroups(orgId: string) {
    const db = getDB();
    return db.selectFrom("groups").selectAll().where("org_id", "=", orgId).execute();
  }

  async update(orgId: string, userId: string, data: { slack_webhook_url?: string }) {
    const db = getDB();
    // Verify caller is owner or admin
    const membership = await db
      .selectFrom("org_memberships")
      .select("role")
      .where("org_id", "=", orgId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Unauthorized");
    }

    await db
      .updateTable("organizations")
      .set({ slack_webhook_url: data.slack_webhook_url ?? null })
      .where("id", "=", orgId)
      .execute();
  }
}
