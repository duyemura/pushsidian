import type { FastifyRequest } from "fastify";
import { verifyToken } from "@clerk/backend";
import { getDB } from "./db";
import { ApiKeyService } from "./api-keys/api-key.service";

export interface CurrentUser {
  id: string;
  clerkId: string;
  email: string;
  displayName: string;
}

export async function verifyAuth(req: FastifyRequest): Promise<CurrentUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7);

  // API keys start with psk_ and are long-lived
  if (token.startsWith("psk_")) {
    const apiKeyService = new ApiKeyService();
    const verified = await apiKeyService.verify(token);
    if (!verified) throw new Error("Unauthorized");

    const db = getDB();
    const subject = await db
      .selectFrom("subjects")
      .selectAll()
      .where("id", "=", verified.userId)
      .executeTakeFirst();

    if (!subject) throw new Error("Unauthorized");

    return {
      id: subject.id,
      clerkId: subject.clerk_id ?? "",
      email: subject.email ?? "",
      displayName: subject.display_name,
    };
  }

  // Otherwise treat as Clerk JWT
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const clerkId = payload.sub as string;
    const email = (payload.email as string) ?? (payload.email_address as string) ?? "";
    const firstName = (payload.first_name as string) ?? (payload.firstName as string) ?? "";
    const lastName = (payload.last_name as string) ?? (payload.lastName as string) ?? "";
    const displayName = firstName
      ? `${firstName} ${lastName}`.trim()
      : email || clerkId.slice(0, 8);

    const db = getDB();
    const userId = `user_${clerkId}`;

    await db
      .insertInto("subjects")
      .values({
        id: userId,
        type: "user",
        clerk_id: clerkId,
        email,
        display_name: displayName,
        avatar_url: null,
        created_at: new Date(),
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          email,
          // NOTE: do not overwrite display_name here —
          // once created, the user controls their name in our app.
        })
      )
      .execute();

    return { id: userId, clerkId, email, displayName };
  } catch (err) {
    console.error("Clerk JWT verification failed:", err);
    const wrapped = new Error("Unauthorized");
    (wrapped as any).cause = err;
    throw wrapped;
  }
}
