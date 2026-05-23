import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { OrgService } from "./organizations/org.service";
import { verifyAuth } from "./auth";
import { getDB } from "./db";

const orgService = new OrgService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/me",
    {
      schema: {
        response: {
          200: z.object({
            id: z.string(),
            clerk_id: z.string(),
            email: z.string(),
            display_name: z.string(),
            slack_handle: z.string().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const db = getDB();
      const subject = await db
        .selectFrom("subjects")
        .select(["id", "clerk_id", "email", "display_name", "slack_handle"])
        .where("id", "=", user.id)
        .executeTakeFirst();
      return {
        id: subject?.id ?? user.id,
        clerk_id: subject?.clerk_id ?? user.clerkId,
        email: subject?.email ?? user.email,
        display_name: subject?.display_name ?? user.displayName,
        slack_handle: subject?.slack_handle ?? null,
      };
    }
  );

  app.put(
    "/me",
    {
      schema: {
        body: z.object({
          display_name: z.string().min(1).max(100).optional(),
          slack_handle: z.string().max(100).nullable().optional(),
        }),
        response: {
          200: z.object({ ok: z.boolean() }),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const body = req.body as { display_name?: string; slack_handle?: string | null };
      const db = getDB();

      const update: { display_name?: string; slack_handle?: string | null } = {};
      if (body.display_name !== undefined) update.display_name = body.display_name.trim();
      if (body.slack_handle !== undefined) update.slack_handle = body.slack_handle?.trim() || null;

      if (Object.keys(update).length > 0) {
        await db
          .updateTable("subjects")
          .set(update)
          .where("id", "=", user.id)
          .execute();
      }

      return { ok: true };
    }
  );

  app.get(
    "/orgs",
    {
      schema: {
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              slug: z.string(),
              display_name: z.string(),
              role: z.string(),
              created_at: z.string().datetime(),
            })
          ),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const orgs = await orgService.listForUser(user.id);
      return orgs.map((o) => ({
        id: o.id,
        slug: o.slug,
        display_name: o.display_name,
        role: o.role,
        created_at: o.created_at.toISOString(),
      }));
    }
  );
};

export default routes;
