import { TFile, normalizePath } from "obsidian";
import type PushsidianPlugin from "../main";

interface RemoteDocument {
  id: string;
  obsidian_path: string;
  title: string | null;
  version: number;
  updated_at: string;
}

export class Downloader {
  constructor(private plugin: PushsidianPlugin) {}

  async syncSharedDocuments() {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;

    try {
      const docs: RemoteDocument[] = await this.plugin.api.getDocuments(this.plugin.settings.orgId);
      const vaultName = this.plugin.app.vault.getName();

      for (const doc of docs) {
        // Skip own documents (they're already in the vault)
        if (doc.obsidian_path.startsWith(".pushsidian/")) continue;

        const targetPath = `.pushsidian/shared/${doc.id}/${doc.obsidian_path}`;
        const normalized = normalizePath(targetPath);
        const existing = this.plugin.app.vault.getAbstractFileByPath(normalized);

        // Fetch content URL
        const metaRes = await fetch(`${this.plugin.api.baseUrl}/api/documents/${doc.id}`, {
          headers: this.plugin.api.headers,
        });
        if (!metaRes.ok) continue;
        const meta = await metaRes.json();

        // Fetch actual content
        const contentRes = await fetch(meta.content_url);
        if (!contentRes.ok) continue;
        const content = await contentRes.text();

        if (existing instanceof TFile) {
          await this.plugin.app.vault.modify(existing, content);
        } else {
          await this.ensureDirectory(normalized);
          await this.plugin.app.vault.create(normalized, content);
        }
      }
    } catch (err) {
      console.error("[Pushsidian] Failed to sync shared docs:", err);
    }
  }

  private async ensureDirectory(filePath: string) {
    const parts = filePath.split("/");
    parts.pop(); // remove filename
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.plugin.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.plugin.app.vault.createFolder(current);
      }
    }
  }
}
