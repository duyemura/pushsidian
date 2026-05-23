export class SlackService {
  private token: string;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN || "";
  }

  private async api(method: string, body: Record<string, unknown>) {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ ok: boolean; error?: string; [key: string]: unknown }>;
  }

  async resolveHandle(handle: string): Promise<string | null> {
    const clean = handle.replace(/^@/, "").trim().toLowerCase();
    if (!clean) return null;
    if (!this.token) return null;

    const data = await this.api("users.lookupByEmail", { email: clean });
    if (data.ok && data.user) {
      return (data.user as any).id as string;
    }

    // Fallback: search by username via users.list
    const list = await this.api("users.list", { limit: 200 });
    if (!list.ok || !list.members) return null;

    const members = list.members as Array<{ id: string; name: string; profile?: { email?: string } }>;
    const match = members.find(
      (m) =>
        m.name?.toLowerCase() === clean ||
        m.profile?.email?.toLowerCase() === clean
    );
    return match?.id ?? null;
  }

  async sendDM(userId: string, text: string) {
    if (!this.token) return { ok: false, error: "No Slack bot token configured" };

    // Open a conversation (DM) with the user
    const convo = await this.api("conversations.open", { users: userId });
    if (!convo.ok || !convo.channel) {
      return { ok: false, error: convo.error || "Failed to open conversation" };
    }

    const channelId = (convo.channel as any).id as string;
    return this.api("chat.postMessage", { channel: channelId, text, unfurl_links: true });
  }
}

export const slackService = new SlackService();
