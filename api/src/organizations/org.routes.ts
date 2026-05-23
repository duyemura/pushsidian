import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { OrgService } from "./org.service";
import { verifyAuth } from "../auth";

const orgService = new OrgService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          slug: z.string().min(1).max(50),
          display_name: z.string().min(1).max(100),
        }),
        response: {
          200: z.object({
            id: z.string(),
            slug: z.string(),
            display_name: z.string(),
            created_at: z.string().datetime(),
          }),
        },
      },
    },
    async (req, reply) => {
      const user = await verifyAuth(req);
      const body = req.body as { slug: string; display_name: string };
      const org = await orgService.createOrAttach({
        slug: body.slug,
        display_name: body.display_name,
        owner_id: user.id,
      });
      reply.status(200);
      return {
        id: org.id,
        slug: org.slug,
        display_name: org.display_name,
        created_at: org.created_at.toISOString(),
      };
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            slug: z.string(),
            display_name: z.string(),
            owner_id: z.string(),
            created_at: z.string().datetime(),
          }),
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const org = await orgService.getById(id);
      if (!org) throw new Error("Not found");
      return {
        id: org.id,
        slug: org.slug,
        display_name: org.display_name,
        owner_id: org.owner_id,
        created_at: org.created_at.toISOString(),
      };
    }
  );

  app.get(
    "/:id/members",
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              display_name: z.string(),
              email: z.string().nullable(),
              role: z.string(),
              created_at: z.string().datetime(),
            })
          ),
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const members = await orgService.listMembers(id);
      return members.map((m) => ({
        id: m.id,
        display_name: m.display_name?.trim() || m.email?.split("@")[0] || "Unknown",
        email: m.email,
        role: m.role,
        created_at: m.created_at.toISOString(),
      }));
    }
  );

  app.post(
    "/:id/groups",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          display_name: z.string(),
          slug: z.string(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            display_name: z.string(),
            slug: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { display_name: string; slug: string };
      const group = await orgService.createGroup(id, body.display_name, body.slug);
      reply.status(201);
      return {
        id: group.id,
        display_name: group.display_name,
        slug: group.slug,
      };
    }
  );

  app.get(
    "/:id/groups",
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              display_name: z.string(),
              slug: z.string(),
            })
          ),
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const groups = await orgService.listGroups(id);
      return groups.map((g) => ({
        id: g.id,
        display_name: g.display_name,
        slug: g.slug,
      }));
    }
  );

  app.patch(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          slack_webhook_url: z.string().url().optional(),
        }),
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const { id } = req.params as { id: string };
      const body = req.body as { slack_webhook_url?: string };
      await orgService.update(id, user.id, body);
      return { ok: true };
    }
  );
};

export default routes;
