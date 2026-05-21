import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { DocumentService } from "./document.service";

const documentService = new DocumentService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      schema: {
        querystring: z.object({
          org_id: z.string(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              obsidian_path: z.string(),
              title: z.string().nullable(),
              version: z.number(),
              updated_at: z.string().datetime(),
            })
          ),
        },
      },
    },
    async (req, reply) => {
      // TODO: get userId from auth context
      const userId = "user:placeholder";
      const docs = await documentService.listAccessible(userId, req.query.org_id);
      return docs.map((d) => ({
        id: d.id,
        obsidian_path: d.obsidian_path,
        title: d.title,
        version: d.version,
        updated_at: d.updated_at.toISOString(),
      }));
    }
  );

  app.post(
    "/",
    {
      schema: {
        body: z.object({
          org_id: z.string(),
          vault_id: z.string(),
          obsidian_path: z.string(),
          title: z.string().optional(),
          content: z.string(),
          content_hash: z.string(),
          rules: z.array(
            z.object({
              subject_id: z.string(),
              relation: z.enum(["reader", "writer", "owner"]),
            })
          ),
        }),
        response: {
          201: z.object({ id: z.string() }),
        },
      },
    },
    async (req, reply) => {
      // TODO: get userId from auth context
      const userId = "user:placeholder";
      // TODO: upload content to S3, create doc + rules
      const doc = await documentService.create({
        org_id: req.body.org_id,
        owner_id: userId,
        s3_key: `placeholder/${req.body.obsidian_path}`,
        vault_id: req.body.vault_id,
        obsidian_path: req.body.obsidian_path,
        title: req.body.title ?? null,
        content_hash: req.body.content_hash,
      });
      reply.status(201);
      return { id: doc.id };
    }
  );
};

export default routes;
