import type { FastifyRequest } from "fastify";
import { getDB } from "./db";

export interface CurrentUser {
  id: string;
  clerkId: string;
  email: string;
  displayName: string;
}

export async function verifyAuth(req: FastifyRequest): Promise<CurrentUser> {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    throw new Error("Unauthorized");
  }

  const clerkId = auth.userId as string;
  const email = (auth.sessionClaims?.email as string) ?? "";
  const displayName =
    (auth.sessionClaims?.firstName as string)
      ? `${auth.sessionClaims?.firstName} ${(auth.sessionClaims?.lastName as string) ?? ""}`.trim()
      : email;

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
        display_name: displayName,
      })
    )
    .execute();

  return { id: userId, clerkId, email, displayName };
}
