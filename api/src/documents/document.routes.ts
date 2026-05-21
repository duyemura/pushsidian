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
      const docs = await documentService.listAccessible(user.id, req.query.org_id);
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
      const docId = await documentService.upsertWithContent({
        org_id: req.body.org_id,
        owner_id: user.id,
        vault_id: req.body.vault_id,
        obsidian_path: req.body.obsidian_path,
        title: req.body.title ?? null,
        content: req.body.content,
        content_hash: req.body.content_hash,
        rules: req.body.rules,
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
      const user = await verifyAuth(req);
      const doc = await documentService.getById(req.params.id);
      if (!doc) throw new Error("Not found");
      // TODO: verify ACL
      const { getDocumentUrl } = await import("../s3");
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
      const rules = await documentService.getRules(req.params.id);
      return rules.map((r) => ({
        subject_id: r.subject_id,
        relation: r.relation,
      }));
    }
  );
};

export default routes;
