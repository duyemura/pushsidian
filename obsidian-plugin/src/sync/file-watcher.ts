import { TFile, MetadataCache, Notice } from "obsidian";
import type PushsidianPlugin from "../main";
import { ShareModal } from "../ui/share-modal";

interface FileCacheEntry {
  contentHash: string;
  lastSyncAt: number;
}

interface Member {
  id: string;
  display_name: string;
}

export class FileWatcher {
  private cache: Map<string, FileCacheEntry> = new Map();
  private syncQueue: Set<string> = new Set();
  private syncTimer: number | null = null;
  private memberCache: { members: Member[]; fetchedAt: number } | null = null;

  constructor(private plugin: PushsidianPlugin) {}

  private async getMembers(): Promise<Member[]> {
    const now = Date.now();
    if (this.memberCache && now - this.memberCache.fetchedAt < 5 * 60 * 1000) {
      return this.memberCache.members;
    }
    const members = await this.plugin.api.getOrgMembers(this.plugin.settings.orgId);
    this.memberCache = { members, fetchedAt: now };
    return members;
  }

  async onFileChange(file: TFile) {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;

    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const shareValue = cache?.frontmatter?.share;
    const hasShare = !!shareValue;

    // Run mention detection on ALL markdown files, even ones not yet shared
    if (file.extension === "md") {
      const content = await this.plugin.app.vault.read(file);
      const rules = shareValue ? await this.buildRules(shareValue) : [];
      void this.checkMentions(file, content, rules);
    }

    // Only queue sync for shared files
    if (hasShare) {
      this.syncQueue.add(file.path);
      this.scheduleSync();
    }
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
      const rules = await this.buildRules(share);

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

  private async checkMentions(file: TFile, content: string, rules: { subject_id: string }[]) {
    const mentionRegex = /@([A-Za-z0-9_]{2,40})/g;
    const mentions = new Set<string>();
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.add(match[1].trim().toLowerCase());
    }
    if (mentions.size === 0) return;

    try {
      const members = await this.getMembers();
      const currentSubjects = new Set(rules.map((r) => r.subject_id));
      const pending: string[] = [];
      const mentionWords = Array.from(mentions);

      for (const member of members) {
        if (!member.display_name?.trim()) continue;
        const nameLower = member.display_name.toLowerCase();
        const nameTokens = nameLower.split(/\s+/);
        const isMentioned = mentionWords.some(
          (m) => nameLower === m || nameTokens.includes(m)
        );
        if (isMentioned && !currentSubjects.has(member.id)) {
          pending.push(member.id);
        }
      }

      if (pending.length > 0) {
        // Merge with any existing pending mentions so state accumulates
        const existing = (this.plugin as any).__pendingMentions || [];
        const merged = Array.from(new Set([...existing, ...pending]));
        (this.plugin as any).__pendingMentions = merged;

        // Skip if we just saved (processFrontMatter triggers a file change)
        const grace = (this.plugin as any).__shareSaveGrace;
        if (grace && Date.now() - grace < 2000) return;

        // Open the share modal directly with pending pre-checked
        // (skip if already open to avoid stacking modals)
        if (!(this.plugin as any).__shareModalOpen) {
          (this.plugin as any).__shareModalOpen = true;
          const modal = new ShareModal(this.plugin.app, this.plugin, file, merged);
          modal.open();
        }
      }
    } catch {
      // Silently fail mention detection
    }
  }

  private async buildRules(share: boolean | string | string[]): Promise<{ subject_id: string; relation: string }[]> {
    if (share === true) {
      return [{ subject_id: "everyone", relation: "reader" }];
    }
    const items = Array.isArray(share) ? share : [share];
    const members = await this.getMembers();

    return items
      .filter((s) => typeof s === "string")
      .map((s) => {
        const lower = s.toLowerCase();
        if (lower === "everyone") {
          return { subject_id: "everyone", relation: "reader" as const };
        }
        // Resolve display name to member ID
        const member = members.find((m) => m.display_name?.toLowerCase() === lower);
        if (member) {
          return { subject_id: member.id, relation: "reader" as const };
        }
        console.warn(`[Pushsidian] Could not resolve share target "${s}" to a member — sharing rule will be skipped.`);
        // Fallback: treat as raw ID (backward compat)
        return { subject_id: s, relation: "reader" as const };
      });
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
