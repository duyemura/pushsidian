import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { DocumentService } from "./document.service";
import { verifyAuth } from "../auth";
import { getDB } from "../db";

const documentService = new DocumentService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      schema: {
        querystring: z.object({
          org_id: z.string(),
          owner_id: z.string().optional(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              obsidian_path: z.string(),
              title: z.string().nullable(),
              owner_id: z.string(),
              owner_name: z.string(),
              org_name: z.string(),
              version: z.number(),
              updated_at: z.string().datetime(),
              share_summary: z.string(),
            })
          ),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      const { org_id, owner_id } = req.query as { org_id: string; owner_id?: string };
      const docs = await documentService.listAccessible(user.id, org_id, owner_id);
      const db = getDB();
      const org = await db.selectFrom("organizations").select("display_name").where("id", "=", org_id).executeTakeFirst();
      const orgName = org?.display_name ?? "Shared";

      const subjects = await db.selectFrom("subjects").select(["id", "display_name"]).where("id", "in", [...new Set(docs.map((d) => d.owner_id))]).execute();
      const nameById = new Map(subjects.map((s) => [s.id, s.display_name]));

      // Fetch sharing rules for all docs in one query
      const docIds = docs.map((d) => d.id);
      const rules = docIds.length > 0
        ? await db
            .selectFrom("document_rules")
            .innerJoin("subjects", "subjects.id", "document_rules.subject_id")
            .select(["document_rules.document_id", "document_rules.subject_id", "subjects.display_name"])
            .where("document_rules.document_id", "in", docIds)
            .execute()
        : [];
      const rulesByDoc = new Map<string, { subject_id: string; display_name: string }[]>();
      for (const r of rules) {
        const arr = rulesByDoc.get(r.document_id) || [];
        arr.push({ subject_id: r.subject_id, display_name: r.display_name });
        rulesByDoc.set(r.document_id, arr);
      }
      // Resolve group IDs for "everyone" detection
      const everyoneGroup = await db.selectFrom("groups").select("id").where("org_id", "=", org_id).where("slug", "=", "everyone").executeTakeFirst();
      const everyoneId = everyoneGroup?.id ?? "everyone";

      return docs.map((d) => {
        const docRules = rulesByDoc.get(d.id) || [];
        const isOwner = d.owner_id === user.id;

        let share_summary: string;
        if (!isOwner) {
          // Non-owned docs: generic label
          share_summary = docRules.length > 0 ? "Shared" : "Private";
        } else {
          // Owned docs: show actual names
          const sharedWithEveryone = docRules.some((r) => r.subject_id === "everyone" || r.subject_id === everyoneId);
          if (sharedWithEveryone) {
            share_summary = "Everyone";
          } else if (docRules.length === 0) {
            share_summary = "Private";
          } else {
            const names = docRules.map((r) => r.display_name || r.subject_id.split("_").pop()?.slice(0, 8) || r.subject_id);
            share_summary = names.join(", ");
          }
        }

        return {
          id: d.id,
          obsidian_path: d.obsidian_path,
          title: d.title,
          owner_id: d.owner_id,
          owner_name: d.owner_id === user.id ? "You" : (nameById.get(d.owner_id) ?? d.owner_id.split("_").pop()?.slice(0, 8) ?? d.owner_id),
          org_name: orgName,
          version: d.version,
          updated_at: d.updated_at.toISOString(),
          share_summary,
        };
      });
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
      const user = await verifyAuth(req);
      const { id } = req.params as { id: string };
      const canAccess = await documentService.canAccess(user.id, id);
      if (!canAccess) throw new Error("Unauthorized");
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
    "/:id/content",
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (req, reply) => {
      const user = await verifyAuth(req);
      const { id } = req.params as { id: string };
      const canAccess = await documentService.canAccess(user.id, id);
      if (!canAccess) throw new Error("Unauthorized");
      const doc = await documentService.getById(id);
      if (!doc) throw new Error("Not found");
      const { getDocumentContent } = await import("../s3.js");
      const content = await getDocumentContent(doc.s3_key);
      return { content };
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
