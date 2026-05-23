import "dotenv/config";
import fastify from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import documentRoutes from "./documents/document.routes";
import orgRoutes from "./organizations/org.routes";
import searchRoutes from "./search/search.routes";
import apiKeyRoutes from "./api-keys/api-key.routes";
import inviteRoutes from "./invites/invite.routes";
import clerkWebhookRoutes from "./webhooks/clerk.routes";
import userRoutes from "./user.routes";

async function main() {
  const app = fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:5175", "app://obsidian.md"],
    credentials: true,
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof Error && err.message === "Unauthorized") {
      const isDev = process.env.NODE_ENV !== "production";
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: isDev && (err as any).cause ? String((err as any).cause) : "Invalid or missing token",
      });
    }
    reply.send(err);
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(documentRoutes, { prefix: "/api/documents" });
  await app.register(orgRoutes, { prefix: "/api/orgs" });
  await app.register(searchRoutes, { prefix: "/api/search" });
  await app.register(apiKeyRoutes, { prefix: "/api/keys" });
  await app.register(inviteRoutes, { prefix: "/api/invites" });
  await app.register(userRoutes, { prefix: "/api/user" });
  await app.register(clerkWebhookRoutes, { prefix: "/webhooks" });

  const port = parseInt(process.env.PORT || "8080", 10);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
