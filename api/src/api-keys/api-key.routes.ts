import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ApiKeyService } from "./api-key.service";
import { verifyAuth } from "../auth";

const apiKeyService = new ApiKeyService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          org_id: z.string(),
          label: z.string().optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            key: z.string(),
            label: z.string().nullable(),
            org_id: z.string(),
            created_at: z.string().datetime(),
          }),
        },
      },
    },
    async (req, reply) => {
      const user = await verifyAuth(req);
      const body = req.body as { org_id: string; label?: string };
      const { rawKey } = await apiKeyService.create({
        user_id: user.id,
        org_id: body.org_id,
        label: body.label,
      });

      // Fetch the created record to get its generated id
      const keys = await apiKeyService.listForUser(user.id);
      const created = keys.find((k) => k.org_name); // not ideal; refetch by hash

      reply.status(201);
      return {
        id: created?.id ?? "",
        key: rawKey,
        label: body.label ?? null,
        org_id: body.org_id,
        created_at: new Date().toISOString(),
      };
    }
  );

  app.get(
    "/",
    {
      schema: {
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              label: z.string().nullable(),
              org_name: z.string(),
              created_at: z.string().datetime(),
              last_used_at: z.string().datetime().nullable(),
            })
          ),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const keys = await apiKeyService.listForUser(user.id);
      return keys.map((k) => ({
        id: k.id,
        label: k.label,
        org_name: k.org_name,
        created_at: k.created_at.toISOString(),
        last_used_at: k.last_used_at?.toISOString() ?? null,
      }));
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (req, reply) => {
      const user = await verifyAuth(req);
      const { id } = req.params as { id: string };
      await apiKeyService.revoke(id, user.id);
      reply.status(204);
      return {};
    }
  );
};

export default routes;
