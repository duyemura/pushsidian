import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { DocumentService } from "./document.service";
import { verifyAuth } from "../auth";

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
    async (req) => {
      const user = await verifyAuth(req);
      const { org_id } = req.query as { org_id: string };
      const docs = await documentService.listAccessible(user.id, org_id);
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
          ).default([]),
        }),
        response: {
          201: z.object({ id: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const user = await verifyAuth(req);
      const body = req.body as {
        org_id: string;
        vault_id: string;
        obsidian_path: string;
        title?: string;
        content: string;
        content_hash: string;
        rules: { subject_id: string; relation: string }[];
      };
      const docId = await documentService.upsertWithContent({
        org_id: body.org_id,
        owner_id: user.id,
        vault_id: body.vault_id,
        obsidian_path: body.obsidian_path,
        title: body.title ?? null,
        content: body.content,
        content_hash: body.content_hash,
        rules: body.rules,
      });
      reply.status(201);
      return { id: docId };
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
            obsidian_path: z.string(),
            title: z.string().nullable(),
            content_url: z.string(),
            version: z.number(),
            updated_at: z.string().datetime(),
          }),
        },
      },
    },
    async (req) => {
      await verifyAuth(req);
      const { id } = req.params as { id: string };
      const doc = await documentService.getById(id);
      if (!doc) throw new Error("Not found");
      const { getDocumentUrl } = await import("../s3.js");
      const contentUrl = await getDocumentUrl(doc.s3_key);
      return {
        id: doc.id,
        obsidian_path: doc.obsidian_path,
        title: doc.title,
        content_url: contentUrl,
        version: doc.version,
        updated_at: doc.updated_at.toISOString(),
      };
    }
  );

  app.get(
    "/:id/rules",
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.array(
            z.object({
              subject_id: z.string(),
              relation: z.string(),
            })
          ),
        },
      },
    },
    async (req) => {
      await verifyAuth(req);
      const { id } = req.params as { id: string };
      const rules = await documentService.getRules(id);
      return rules.map((r) => ({
        subject_id: r.subject_id,
        relation: r.relation,
      }));
    }
  );
};

export default routes;
