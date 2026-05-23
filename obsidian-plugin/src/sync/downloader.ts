import { TFile, normalizePath } from "obsidian";
import type PushsidianPlugin from "../main";

interface RemoteDocument {
  id: string;
  obsidian_path: string;
  title: string | null;
  owner_id: string;
  owner_name: string;
  org_name: string;
  version: number;
  updated_at: string;
}

interface DownloadCacheEntry {
  version: number;
  syncedAt: number;
}

export class Downloader {
  private cache: Map<string, DownloadCacheEntry> = new Map();
  private userId: string | null = null;

  constructor(private plugin: PushsidianPlugin) {}

  private async ensureUserId(): Promise<string | null> {
    if (this.userId) return this.userId;
    try {
      const user = await this.plugin.api.getUser();
      this.userId = user.id;
      return this.userId;
    } catch {
      return null;
    }
  }

  async syncSharedDocuments() {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;

    const currentUserId = await this.ensureUserId();
    if (!currentUserId) {
      console.warn("[Pushsidian] Cannot sync: failed to resolve current user");
      return;
    }

    try {
      const docs: RemoteDocument[] = await this.plugin.api.getDocuments(this.plugin.settings.orgId);

      for (const doc of docs) {
        // Skip own documents (they're already in the vault)
        if (doc.owner_id === currentUserId) continue;

        const cached = this.cache.get(doc.id);
        if (cached && cached.version >= doc.version) continue;

        const orgSlug = (doc.org_name || "Shared").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const ownerSlug = (doc.owner_name || "unknown").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const targetPath = `${orgSlug}/${ownerSlug}/${doc.obsidian_path}`;
        const normalized = normalizePath(targetPath);
        const existing = this.plugin.app.vault.getAbstractFileByPath(normalized);

        // Fetch content through API proxy (avoids CORS on pre-signed R2 URLs)
        const contentRes = await fetch(`${this.plugin.api.baseUrl}/api/documents/${doc.id}/content`, {
          headers: this.plugin.api.headers,
        });
        if (!contentRes.ok) continue;
        const content = await contentRes.text();

        if (existing instanceof TFile) {
          await this.plugin.app.vault.modify(existing, content);
        } else {
          await this.ensureDirectory(normalized);
          await this.plugin.app.vault.create(normalized, content);
        }

        this.cache.set(doc.id, { version: doc.version, syncedAt: Date.now() });
        console.log(`[Pushsidian] Downloaded shared doc: ${doc.obsidian_path} (v${doc.version})`);
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

  loadCache(data: Record<string, DownloadCacheEntry>) {
    this.cache = new Map(Object.entries(data));
  }

  saveCache(): Record<string, DownloadCacheEntry> {
    return Object.fromEntries(this.cache);
  }
}
