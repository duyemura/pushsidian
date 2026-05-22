import { getDB } from "../db";

async function getWebhookUrl(orgId: string): Promise<string | null> {
  const db = getDB();
  const org = await db
    .selectFrom("organizations")
    .select("slack_webhook_url")
    .where("id", "=", orgId)
    .executeTakeFirst();
  return org?.slack_webhook_url ?? null;
}

async function post(webhookUrl: string, text: string) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.warn("[Pushsidian] Slack webhook failed:", err);
  }
}

export async function notifyMemberJoined(
  orgId: string,
  displayName: string,
  invitedByName: string | null
) {
  const webhookUrl = await getWebhookUrl(orgId);
  if (!webhookUrl) return;

  const name = displayName?.trim() || "Someone";
  const inviter = invitedByName?.trim();
  const text = inviter
    ? `*${name}* joined the team (invited by ${inviter}).`
    : `*${name}* joined the team.`;

  await post(webhookUrl, text);
}
