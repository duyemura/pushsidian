import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { OrgService } from "./org.service";

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
          201: z.object({
            id: z.string(),
            slug: z.string(),
            display_name: z.string(),
            created_at: z.string().datetime(),
          }),
        },
      },
    },
    async (req, reply) => {
      const ownerId = "user:placeholder"; // TODO: from auth
      const org = await orgService.create({
        slug: req.body.slug,
        display_name: req.body.display_name,
        owner_id: ownerId,
      });
      reply.status(201);
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
      const org = await orgService.getById(req.params.id);
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
      const members = await orgService.listMembers(req.params.id);
      return members.map((m) => ({
        id: m.id,
        display_name: m.display_name,
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
      const group = await orgService.createGroup(req.params.id, req.body.display_name, req.body.slug);
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
      const groups = await orgService.listGroups(req.params.id);
      return groups.map((g) => ({
        id: g.id,
        display_name: g.display_name,
        slug: g.slug,
      }));
    }
  );
};

export default routes;
