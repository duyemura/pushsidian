import fastify from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

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

// TODO: Register routes (documents, orgs, search, webhooks)

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3000", 10);
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
