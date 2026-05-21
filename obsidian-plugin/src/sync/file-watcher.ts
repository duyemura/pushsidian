import { TFile, MetadataCache } from "obsidian";
import type PushsidianPlugin from "../main";

interface FileCacheEntry {
  contentHash: string;
  lastSyncAt: number;
}

export class FileWatcher {
  private cache: Map<string, FileCacheEntry> = new Map();
  private syncQueue: Set<string> = new Set();
  private syncTimer: number | null = null;

  constructor(private plugin: PushsidianPlugin) {}

  async onFileChange(file: TFile) {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;

    const cache = this.plugin.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.share) return;

    // Queue for debounced sync
    this.syncQueue.add(file.path);
    this.scheduleSync();
  }

  private scheduleSync() {
    if (this.syncTimer) return;
    this.syncTimer = window.setTimeout(() => {
      this.processQueue();
      this.syncTimer = null;
    }, 2000); // debounce 2s
  }

  private async processQueue() {
    const paths = Array.from(this.syncQueue);
    this.syncQueue.clear();

    for (const path of paths) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      await this.syncFile(file);
    }
  }

  private async syncFile(file: TFile) {
    try {
      const content = await this.plugin.app.vault.read(file);
      const hash = await this.sha256(content);

      const cached = this.cache.get(file.path);
      if (cached?.contentHash === hash) return; // unchanged

      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const share = cache?.frontmatter?.share;
      const rules = this.buildRules(share);

      await this.plugin.api.uploadDocument({
        org_id: this.plugin.settings.orgId,
        vault_id: this.plugin.app.vault.getName(),
        obsidian_path: file.path,
        title: cache?.frontmatter?.title || file.basename,
        content,
        content_hash: hash,
        rules,
      });

      this.cache.set(file.path, { contentHash: hash, lastSyncAt: Date.now() });
      console.log(`[Pushsidian] Synced: ${file.path}`);
    } catch (err) {
      console.error(`[Pushsidian] Failed to sync ${file.path}:`, err);
    }
  }

  private buildRules(share: string | string[]): { subject_id: string; relation: string }[] {
    const items = Array.isArray(share) ? share : [share];
    // Phase 1: map slugs to subject_ids via API lookup (not implemented yet)
    // For now, assume items are subject_ids prefixed with group_ or user_
    return items
      .filter((s) => typeof s === "string")
      .map((s) => ({
        subject_id: String(s),
        relation: "reader" as const,
      }));
  }

  private async sha256(content: string): Promise<string> {
    const buf = new TextEncoder().encode(content);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  loadCache(data: Record<string, FileCacheEntry>) {
    this.cache = new Map(Object.entries(data));
  }

  saveCache(): Record<string, FileCacheEntry> {
    return Object.fromEntries(this.cache);
  }
}
