import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { getDB } from "../db";

const ClerkWebhookBody = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/clerk",
    {
      schema: {
        body: ClerkWebhookBody,
      },
    },
    async (req, reply) => {
      // TODO: verify Clerk webhook signature using CLERK_WEBHOOK_SECRET
      const { type, data } = req.body as { type: string; data: any };

      if (type === "user.created" || type === "user.updated") {
        const db = getDB();
        const userId = `user_${data.id}`;
        const email = data.email_addresses?.[0]?.email_address ?? "";
        const displayName = data.first_name
          ? `${data.first_name} ${data.last_name ?? ""}`.trim()
          : data.username || email || "User";

        await db
          .insertInto("subjects")
          .values({
            id: userId,
            type: "user",
            clerk_id: data.id,
            email,
            display_name: displayName,
            avatar_url: data.image_url ?? null,
            created_at: new Date(),
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              email,
              display_name: displayName,
              avatar_url: data.image_url ?? null,
            })
          )
          .execute();
      }

      reply.status(200);
      return { received: true };
    }
  );
};

export default routes;
