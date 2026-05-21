import "dotenv/config";
import fastify from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import documentRoutes from "./documents/document.routes";
import orgRoutes from "./organizations/org.routes";
import searchRoutes from "./search/search.routes";
import clerkWebhookRoutes from "./webhooks/clerk.routes";
import userRoutes from "./user.routes";

async function main() {
  const app = fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: ["http://localhost:5173", "app://obsidian.md"],
    credentials: true,
  });

  await app.register(clerkPlugin, {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(documentRoutes, { prefix: "/api/documents" });
  await app.register(orgRoutes, { prefix: "/api/orgs" });
  await app.register(searchRoutes, { prefix: "/api/search" });
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
