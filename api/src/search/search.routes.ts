import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SearchService } from "./search.service";
import { verifyAuth } from "../auth";

const searchService = new SearchService();

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      schema: {
        body: z.object({
          query: z.string(),
          org_id: z.string(),
          limit: z.number().int().min(1).max(100).optional().default(20),
        }),
        response: {
          200: z.array(
            z.object({
              document_id: z.string(),
              obsidian_path: z.string(),
              title: z.string().nullable(),
              chunk_text: z.string(),
              chunk_index: z.number(),
            })
          ),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      return searchService.fullTextSearch(req.body.query, user.id, req.body.org_id, req.body.limit);
    }
  );

  app.post(
    "/context",
    {
      schema: {
        body: z.object({
          query: z.string(),
          org_id: z.string(),
          limit: z.number().int().min(1).max(50).optional().default(10),
        }),
        response: {
          200: z.array(
            z.object({
              document_id: z.string(),
              obsidian_path: z.string(),
              title: z.string().nullable(),
              chunk_text: z.string(),
              chunk_index: z.number(),
            })
          ),
        },
      },
    },
    async (req) => {
      const user = await verifyAuth(req);
      return searchService.getContextForPrompt(req.body.query, user.id, req.body.org_id, req.body.limit);
    }
  );
};

export default routes;
