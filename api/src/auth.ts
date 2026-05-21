import { clerkClient } from "@clerk/fastify";
import type { FastifyRequest } from "fastify";

export async function getCurrentUser(req: FastifyRequest) {
  // In production this comes from Clerk's fastify plugin
  // For now, return a placeholder until Clerk is wired up
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7);
  // TODO: verify Clerk JWT and look up user in subjects table
  return {
    id: "user:placeholder",
    clerkId: "placeholder",
    email: "user@example.com",
    displayName: "User",
  };
}
