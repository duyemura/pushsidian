import fastify from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import documentRoutes from "./documents/document.routes";
import orgRoutes from "./organizations/org.routes";

const app = fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: ["http://localhost:5173", "app://obsidian.md"],
  credentials: true,
});

// Health check
app.get("/health", async () => ({ status: "ok" }));

// Register routes
await app.register(documentRoutes, { prefix: "/api/documents" });
await app.register(orgRoutes, { prefix: "/api/orgs" });

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "8080", 10);
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
