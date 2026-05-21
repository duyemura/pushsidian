import type PushsidianPlugin from "./main";

export class PushsidianAPI {
  constructor(private plugin: PushsidianPlugin) {}

  get baseUrl() {
    return this.plugin.settings.apiBaseUrl.replace(/\/$/, "");
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.plugin.settings.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async getDocuments(orgId: string) {
    const res = await fetch(`${this.baseUrl}/api/documents?org_id=${encodeURIComponent(orgId)}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
    return res.json();
  }

  async uploadDocument(payload: {
    org_id: string;
    vault_id: string;
    obsidian_path: string;
    title?: string;
    content: string;
    content_hash: string;
    rules: { subject_id: string; relation: string }[];
  }) {
    const res = await fetch(`${this.baseUrl}/api/documents`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to upload document: ${res.status}`);
    return res.json();
  }

  async search(query: string, orgId: string) {
    const res = await fetch(`${this.baseUrl}/api/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, org_id: orgId }),
    });
    if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
    return res.json();
  }
}
