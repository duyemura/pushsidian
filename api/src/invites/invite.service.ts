import { getDB } from "../db";

export class InviteService {
  async create(data: {
    org_id: string;
    slack_handle: string;
    slack_user_id: string | null;
    groups: string[];
    role: string;
    created_by: string;
  }) {
    const db = getDB();
    const token = `inv_${crypto.randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db
      .insertInto("invite_tokens")
      .values({
        id: crypto.randomUUID(),
        org_id: data.org_id,
        slack_handle: data.slack_handle,
        slack_user_id: data.slack_user_id,
        groups: data.groups,
        role: data.role,
        token,
        used_by: null,
        used_at: null,
        created_by: data.created_by,
        expires_at: expiresAt,
        created_at: new Date(),
      })
      .execute();

    return { token, expires_at: expiresAt };
  }

  async getOrg(orgId: string) {
    const db = getDB();
    return db.selectFrom("organizations").selectAll().where("id", "=", orgId).executeTakeFirst();
  }

  async validate(token: string) {
    const db = getDB();
    const invite = await db
      .selectFrom("invite_tokens")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!invite) return null;
    if (invite.used_by) return { used: true as const, invite };
    if (invite.expires_at < new Date()) return { expired: true as const, invite };

    const org = await db.selectFrom("organizations").selectAll().where("id", "=", invite.org_id).executeTakeFirst();
    return { valid: true as const, invite, org };
  }

  async accept(token: string, userId: string) {
    const db = getDB();
    const validation = await this.validate(token);
    if (!validation || !("valid" in validation)) {
      throw new Error("Invalid or expired invite");
    }

    const { invite } = validation;

    // Add user to org
    await db
      .insertInto("org_memberships")
      .values({
        id: crypto.randomUUID(),
        org_id: invite.org_id,
        user_id: userId,
        role: invite.role as "owner" | "admin" | "member",
        created_at: new Date(),
      })
      .onConflict((oc) => oc.columns(["org_id", "user_id"]).doNothing())
      .execute();

    // Add user to specified groups
    for (const groupId of invite.groups || []) {
      await db
        .insertInto("group_memberships")
        .values({ group_id: groupId, user_id: userId })
        .onConflict((oc) => oc.columns(["group_id", "user_id"]).doNothing())
        .execute();
    }

    // Also add to Everyone group if not already in it
    const everyoneGroup = await db
      .selectFrom("groups")
      .select("id")
      .where("org_id", "=", invite.org_id)
      .where("slug", "=", "everyone")
      .executeTakeFirst();

    if (everyoneGroup) {
      await db
        .insertInto("group_memberships")
        .values({ group_id: everyoneGroup.id, user_id: userId })
        .onConflict((oc) => oc.columns(["group_id", "user_id"]).doNothing())
        .execute();
    }

    // Mark token used
    await db
      .updateTable("invite_tokens")
      .set({ used_by: userId, used_at: new Date() })
      .where("token", "=", token)
      .execute();

    return { org_id: invite.org_id };
  }

  async listForOrg(orgId: string) {
    const db = getDB();
    return db
      .selectFrom("invite_tokens")
      .selectAll()
      .where("org_id", "=", orgId)
      .orderBy("created_at", "desc")
      .execute();
  }
}

export const inviteService = new InviteService();
