import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { OrgService } from "./organizations/org.service";
import { verifyAuth } from "./auth";

const orgService = new OrgService();

const routes: FastifyPluginAsyncZod = async (app) => {
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
