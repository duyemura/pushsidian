import { createRequire } from 'module';const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PushsidianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/api.ts
var PushsidianAPI = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  get baseUrl() {
    return this.plugin.settings.apiBaseUrl.replace(/\/$/, "");
  }
  get headers() {
    return {
      Authorization: `Bearer ${this.plugin.settings.apiKey}`,
      "Content-Type": "application/json"
    };
  }
  async getDocuments(orgId) {
    const res = await fetch(`${this.baseUrl}/api/documents?org_id=${encodeURIComponent(orgId)}`, {
      headers: this.headers
    });
    if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
    return res.json();
  }
  async uploadDocument(payload) {
    const res = await fetch(`${this.baseUrl}/api/documents`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Failed to upload document: ${res.status}`);
    return res.json();
  }
  async getUser() {
    const res = await fetch(`${this.baseUrl}/api/user/me`, {
      headers: this.headers
    });
    if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
    return res.json();
  }
  async search(query, orgId) {
    const res = await fetch(`${this.baseUrl}/api/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, org_id: orgId })
    });
    if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
    return res.json();
  }
  async getOrgMembers(orgId) {
    const res = await fetch(`${this.baseUrl}/api/orgs/${encodeURIComponent(orgId)}/members`, {
      headers: this.headers
    });
    if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`);
    return res.json();
  }
};

// src/sync/file-watcher.ts
var import_obsidian2 = require("obsidian");

// src/ui/share-modal.ts
var import_obsidian = require("obsidian");
var ShareModal = class extends import_obsidian.Modal {
  constructor(app, plugin, file, pendingMentions = []) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.pendingMentions = pendingMentions;
  }
  members = [];
  filtered = [];
  currentShare = [];
  // stores display names
  shareWithEveryone = false;
  searchInput = null;
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Share note" });
    const cache = this.plugin.app.metadataCache.getFileCache(this.file);
    const share = cache?.frontmatter?.share;
    if (share === true) {
      this.shareWithEveryone = true;
      this.currentShare = [];
    } else if (Array.isArray(share)) {
      this.currentShare = share.filter((s) => typeof s === "string");
    } else if (typeof share === "string") {
      this.currentShare = [share];
    }
    try {
      this.members = (await this.plugin.api.getOrgMembers(this.plugin.settings.orgId)).filter((m) => m.display_name?.trim().length > 0);
      this.filtered = this.members;
    } catch (err) {
      contentEl.createEl("p", {
        text: "Failed to load team members. Check your API settings.",
        cls: "text-error"
      });
      return;
    }
    this.currentShare = this.currentShare.map((s) => {
      const member = this.members.find((m) => m.id === s || m.display_name.toLowerCase() === s.toLowerCase());
      return member ? member.display_name : s;
    });
    const pendingNames = this.members.filter((m) => this.pendingMentions.includes(m.id)).map((m) => m.display_name).filter((name) => !this.currentShare.some((s) => s.toLowerCase() === name.toLowerCase()));
    for (const name of pendingNames) {
      this.currentShare.push(name);
    }
    new import_obsidian.Setting(contentEl).setName("Share with everyone in org").setDesc("Anyone in your organization can see this note.").addToggle(
      (toggle) => toggle.setValue(this.shareWithEveryone).onChange((val) => {
        this.shareWithEveryone = val;
        this.renderMemberList();
      })
    );
    const searchSetting = new import_obsidian.Setting(contentEl).setName("Find people").setClass("pushsidian-search");
    searchSetting.addSearch((search) => {
      this.searchInput = search;
      search.setPlaceholder("Type @name to filter...");
      search.onChange((val) => {
        const q = val.toLowerCase().replace(/^@/, "");
        this.filtered = q ? this.members.filter((m) => m.display_name.toLowerCase().includes(q)) : this.members;
        this.renderMemberList();
      });
    });
    const listEl = contentEl.createDiv({ cls: "pushsidian-member-list" });
    listEl.id = "pushsidian-member-list";
    listEl.style.paddingBottom = "8px";
    this.renderMemberList();
    const actionRow = new import_obsidian.Setting(contentEl);
    actionRow.addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => this.save())
    );
    actionRow.addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  renderMemberList() {
    const listEl = this.contentEl.querySelector("#pushsidian-member-list");
    if (!listEl) return;
    listEl.empty();
    if (this.shareWithEveryone) {
      listEl.createEl("p", { text: "Sharing with everyone \u2014 specific people hidden.", cls: "text-sm text-gray-400 italic" });
      return;
    }
    if (this.filtered.length === 0) {
      listEl.createEl("p", { text: "No members match your search.", cls: "text-sm text-gray-400" });
      return;
    }
    for (const member of this.filtered) {
      if (!member.display_name?.trim()) continue;
      const isChecked = this.currentShare.some(
        (s) => s.toLowerCase() === member.display_name.toLowerCase()
      );
      const row = new import_obsidian.Setting(listEl).setName(member.display_name).addToggle(
        (toggle) => toggle.setValue(isChecked).onChange((val) => {
          if (val) {
            this.currentShare.push(member.display_name);
          } else {
            this.currentShare = this.currentShare.filter(
              (s) => s.toLowerCase() !== member.display_name.toLowerCase()
            );
          }
        })
      );
      row.settingEl.style.marginBottom = "0";
    }
  }
  async save() {
    this.plugin.__shareSaveGrace = Date.now();
    await this.plugin.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
      if (this.shareWithEveryone) {
        frontmatter.share = true;
      } else if (this.currentShare.length === 0) {
        delete frontmatter.share;
      } else if (this.currentShare.length === 1) {
        frontmatter.share = this.currentShare[0];
      } else {
        frontmatter.share = this.currentShare;
      }
    });
    new import_obsidian.Notice("Sharing rules updated \u2014 note will sync shortly");
    delete this.plugin.__pendingMentions;
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.__shareModalOpen = false;
  }
};

// src/sync/file-watcher.ts
var FileWatcher = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  cache = /* @__PURE__ */ new Map();
  syncQueue = /* @__PURE__ */ new Set();
  syncTimer = null;
  memberCache = null;
  async getMembers() {
    const now = Date.now();
    if (this.memberCache && now - this.memberCache.fetchedAt < 5 * 60 * 1e3) {
      return this.memberCache.members;
    }
    const members = await this.plugin.api.getOrgMembers(this.plugin.settings.orgId);
    this.memberCache = { members, fetchedAt: now };
    return members;
  }
  async onFileChange(file) {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const shareValue = cache?.frontmatter?.share;
    const hasShare = !!shareValue;
    if (file.extension === "md") {
      const content = await this.plugin.app.vault.read(file);
      const rules = shareValue ? await this.buildRules(shareValue) : [];
      void this.checkMentions(file, content, rules);
    }
    if (hasShare) {
      this.syncQueue.add(file.path);
      this.scheduleSync();
    }
  }
  scheduleSync() {
    if (this.syncTimer) return;
    this.syncTimer = window.setTimeout(() => {
      this.processQueue();
      this.syncTimer = null;
    }, 2e3);
  }
  async processQueue() {
    const paths = Array.from(this.syncQueue);
    this.syncQueue.clear();
    for (const path of paths) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian2.TFile)) continue;
      await this.syncFile(file);
    }
  }
  async syncFile(file) {
    try {
      const content = await this.plugin.app.vault.read(file);
      const hash = await this.sha256(content);
      const cached = this.cache.get(file.path);
      if (cached?.contentHash === hash) return;
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
        rules
      });
      this.cache.set(file.path, { contentHash: hash, lastSyncAt: Date.now() });
      console.log(`[Pushsidian] Synced: ${file.path}`);
    } catch (err) {
      console.error(`[Pushsidian] Failed to sync ${file.path}:`, err);
    }
  }
  async checkMentions(file, content, rules) {
    const mentionRegex = /@([A-Za-z0-9_]{2,40})/g;
    const mentions = /* @__PURE__ */ new Set();
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.add(match[1].trim().toLowerCase());
    }
    if (mentions.size === 0) return;
    try {
      const members = await this.getMembers();
      const currentSubjects = new Set(rules.map((r) => r.subject_id));
      const pending = [];
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
        const existing = this.plugin.__pendingMentions || [];
        const merged = Array.from(/* @__PURE__ */ new Set([...existing, ...pending]));
        this.plugin.__pendingMentions = merged;
        const grace = this.plugin.__shareSaveGrace;
        if (grace && Date.now() - grace < 2e3) return;
        if (!this.plugin.__shareModalOpen) {
          this.plugin.__shareModalOpen = true;
          const modal = new ShareModal(this.plugin.app, this.plugin, file, merged);
          modal.open();
        }
      }
    } catch {
    }
  }
  async buildRules(share) {
    if (share === true) {
      return [{ subject_id: "everyone", relation: "reader" }];
    }
    const items = Array.isArray(share) ? share : [share];
    const members = await this.getMembers();
    return items.filter((s) => typeof s === "string").map((s) => {
      const lower = s.toLowerCase();
      if (lower === "everyone") {
        return { subject_id: "everyone", relation: "reader" };
      }
      const member = members.find((m) => m.display_name?.toLowerCase() === lower);
      if (member) {
        return { subject_id: member.id, relation: "reader" };
      }
      console.warn(`[Pushsidian] Could not resolve share target "${s}" to a member \u2014 sharing rule will be skipped.`);
      return { subject_id: s, relation: "reader" };
    });
  }
  async sha256(content) {
    const buf = new TextEncoder().encode(content);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  loadCache(data) {
    this.cache = new Map(Object.entries(data));
  }
  saveCache() {
    return Object.fromEntries(this.cache);
  }
};

// src/sync/downloader.ts
var import_obsidian3 = require("obsidian");
var Downloader = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  cache = /* @__PURE__ */ new Map();
  userId = null;
  async ensureUserId() {
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
      const docs = await this.plugin.api.getDocuments(this.plugin.settings.orgId);
      for (const doc of docs) {
        if (doc.owner_id === currentUserId) continue;
        const cached = this.cache.get(doc.id);
        if (cached && cached.version >= doc.version) continue;
        const orgSlug = (doc.org_name || "Shared").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const ownerSlug = (doc.owner_name || "unknown").replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const targetPath = `${orgSlug}/${ownerSlug}/${doc.obsidian_path}`;
        const normalized = (0, import_obsidian3.normalizePath)(targetPath);
        const existing = this.plugin.app.vault.getAbstractFileByPath(normalized);
        const contentRes = await fetch(`${this.plugin.api.baseUrl}/api/documents/${doc.id}/content`, {
          headers: this.plugin.api.headers
        });
        if (!contentRes.ok) continue;
        const content = await contentRes.text();
        if (existing instanceof import_obsidian3.TFile) {
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
  async ensureDirectory(filePath) {
    const parts = filePath.split("/");
    parts.pop();
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.plugin.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.plugin.app.vault.createFolder(current);
      }
    }
  }
  loadCache(data) {
    this.cache = new Map(Object.entries(data));
  }
  saveCache() {
    return Object.fromEntries(this.cache);
  }
};

// src/main.ts
var VIEW_TYPE_TEAM = "pushsidian-team-panel";
var DEFAULT_SETTINGS = {
  apiKey: "",
  apiBaseUrl: "https://api.pushsidian.com",
  orgId: "",
  syncEnabled: true
};
var TeamPanelView = class extends import_obsidian4.ItemView {
  constructor(leaf) {
    super(leaf);
  }
  getViewType() {
    return VIEW_TYPE_TEAM;
  }
  getDisplayText() {
    return "Team Knowledge";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h4", { text: "Team Knowledge" });
    container.createEl("p", { text: "Shared documents will appear here." });
  }
};
var PushsidianPlugin = class extends import_obsidian4.Plugin {
  settings;
  api;
  fileWatcher;
  downloader;
  async onload() {
    await this.loadSettings();
    this.api = new PushsidianAPI(this);
    this.fileWatcher = new FileWatcher(this);
    this.downloader = new Downloader(this);
    this.addRibbonIcon("share", "Share note", () => {
      const file = this.app.workspace.getActiveFile();
      if (file) {
        const pending = this.__pendingMentions || [];
        new ShareModal(this.app, this, file, pending).open();
      } else {
        new import_obsidian4.Notice("No file is currently open");
      }
    });
    this.addCommand({
      id: "share-note",
      name: "Share current note",
      editorCallback: (editor, ctx) => {
        if (ctx.file) {
          const pending = this.__pendingMentions || [];
          new ShareModal(this.app, this, ctx.file, pending).open();
        }
      }
    });
    this.registerView(VIEW_TYPE_TEAM, (leaf) => new TeamPanelView(leaf));
    this.addCommand({
      id: "open-team-panel",
      name: "Open team knowledge panel",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "sync-shared-docs",
      name: "Sync shared documents now",
      callback: async () => {
        await this.downloader.syncSharedDocuments();
        new import_obsidian4.Notice("Shared documents synced");
      }
    });
    this.addSettingTab(new PushsidianSettingTab(this.app, this));
    if (this.settings.syncEnabled) {
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof import_obsidian4.TFile && file.extension === "md") {
            this.fileWatcher.onFileChange(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof import_obsidian4.TFile && file.extension === "md") {
            this.fileWatcher.onFileChange(file);
          }
        })
      );
    }
    this.downloader.syncSharedDocuments();
  }
  async activateView() {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_TEAM);
    let leaf = leaves.length > 0 ? leaves[0] : null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE_TEAM, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
  onunload() {
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    this.fileWatcher?.loadCache(data?.syncCache ?? {});
    this.downloader?.loadCache(data?.downloadCache ?? {});
  }
  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      syncCache: this.fileWatcher?.saveCache() ?? {},
      downloadCache: this.downloader?.saveCache() ?? {}
    });
  }
};
var PushsidianSettingTab = class extends import_obsidian4.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Pushsidian Settings" });
    new import_obsidian4.Setting(containerEl).setName("API Key").setDesc("Your Pushsidian API key from the web app").addText(
      (text) => text.setPlaceholder("psk_...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("API Base URL").setDesc("Override the API endpoint").addText(
      (text) => text.setPlaceholder("https://api.pushsidian.com").setValue(this.plugin.settings.apiBaseUrl).onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Organization ID").setDesc("Your team organization ID").addText(
      (text) => text.setPlaceholder("org_...").setValue(this.plugin.settings.orgId).onChange(async (value) => {
        this.plugin.settings.orgId = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Enable sync").setDesc("Automatically sync shared notes").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncEnabled).onChange(async (value) => {
        this.plugin.settings.syncEnabled = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL2FwaS50cyIsICJzcmMvc3luYy9maWxlLXdhdGNoZXIudHMiLCAic3JjL3VpL3NoYXJlLW1vZGFsLnRzIiwgInNyYy9zeW5jL2Rvd25sb2FkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgVEZpbGUsIE5vdGljZSwgTW9kYWwsIEFwcCwgU2V0dGluZywgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYsIFBsdWdpblNldHRpbmdUYWIgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IFB1c2hzaWRpYW5BUEkgfSBmcm9tIFwiLi9hcGlcIjtcbmltcG9ydCB7IEZpbGVXYXRjaGVyIH0gZnJvbSBcIi4vc3luYy9maWxlLXdhdGNoZXJcIjtcbmltcG9ydCB7IERvd25sb2FkZXIgfSBmcm9tIFwiLi9zeW5jL2Rvd25sb2FkZXJcIjtcbmltcG9ydCB7IFNoYXJlTW9kYWwgfSBmcm9tIFwiLi91aS9zaGFyZS1tb2RhbFwiO1xuXG5jb25zdCBWSUVXX1RZUEVfVEVBTSA9IFwicHVzaHNpZGlhbi10ZWFtLXBhbmVsXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHVzaHNpZGlhblNldHRpbmdzIHtcbiAgYXBpS2V5OiBzdHJpbmc7XG4gIGFwaUJhc2VVcmw6IHN0cmluZztcbiAgb3JnSWQ6IHN0cmluZztcbiAgc3luY0VuYWJsZWQ6IGJvb2xlYW47XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFB1c2hzaWRpYW5TZXR0aW5ncyA9IHtcbiAgYXBpS2V5OiBcIlwiLFxuICBhcGlCYXNlVXJsOiBcImh0dHBzOi8vYXBpLnB1c2hzaWRpYW4uY29tXCIsXG4gIG9yZ0lkOiBcIlwiLFxuICBzeW5jRW5hYmxlZDogdHJ1ZSxcbn07XG5cbmNsYXNzIFRlYW1QYW5lbFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYpIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCkge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVEVBTTtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCkge1xuICAgIHJldHVybiBcIlRlYW0gS25vd2xlZGdlXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJoNFwiLCB7IHRleHQ6IFwiVGVhbSBLbm93bGVkZ2VcIiB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJTaGFyZWQgZG9jdW1lbnRzIHdpbGwgYXBwZWFyIGhlcmUuXCIgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUHVzaHNpZGlhblBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBQdXNoc2lkaWFuU2V0dGluZ3M7XG4gIGFwaTogUHVzaHNpZGlhbkFQSTtcbiAgZmlsZVdhdGNoZXI6IEZpbGVXYXRjaGVyO1xuICBkb3dubG9hZGVyOiBEb3dubG9hZGVyO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIHRoaXMuYXBpID0gbmV3IFB1c2hzaWRpYW5BUEkodGhpcyk7XG4gICAgdGhpcy5maWxlV2F0Y2hlciA9IG5ldyBGaWxlV2F0Y2hlcih0aGlzKTtcbiAgICB0aGlzLmRvd25sb2FkZXIgPSBuZXcgRG93bmxvYWRlcih0aGlzKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInNoYXJlXCIsIFwiU2hhcmUgbm90ZVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgIGNvbnN0IHBlbmRpbmcgPSAodGhpcyBhcyBhbnkpLl9fcGVuZGluZ01lbnRpb25zIHx8IFtdO1xuICAgICAgICBuZXcgU2hhcmVNb2RhbCh0aGlzLmFwcCwgdGhpcywgZmlsZSwgcGVuZGluZykub3BlbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3IE5vdGljZShcIk5vIGZpbGUgaXMgY3VycmVudGx5IG9wZW5cIik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic2hhcmUtbm90ZVwiLFxuICAgICAgbmFtZTogXCJTaGFyZSBjdXJyZW50IG5vdGVcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yLCBjdHgpID0+IHtcbiAgICAgICAgaWYgKGN0eC5maWxlKSB7XG4gICAgICAgICAgY29uc3QgcGVuZGluZyA9ICh0aGlzIGFzIGFueSkuX19wZW5kaW5nTWVudGlvbnMgfHwgW107XG4gICAgICAgICAgbmV3IFNoYXJlTW9kYWwodGhpcy5hcHAsIHRoaXMsIGN0eC5maWxlLCBwZW5kaW5nKS5vcGVuKCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfVEVBTSwgKGxlYWYpID0+IG5ldyBUZWFtUGFuZWxWaWV3KGxlYWYpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLXRlYW0tcGFuZWxcIixcbiAgICAgIG5hbWU6IFwiT3BlbiB0ZWFtIGtub3dsZWRnZSBwYW5lbFwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic3luYy1zaGFyZWQtZG9jc1wiLFxuICAgICAgbmFtZTogXCJTeW5jIHNoYXJlZCBkb2N1bWVudHMgbm93XCIsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmRvd25sb2FkZXIuc3luY1NoYXJlZERvY3VtZW50cygpO1xuICAgICAgICBuZXcgTm90aWNlKFwiU2hhcmVkIGRvY3VtZW50cyBzeW5jZWRcIik7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBQdXNoc2lkaWFuU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgLy8gRmlsZSB3YXRjaGVyc1xuICAgIGlmICh0aGlzLnNldHRpbmdzLnN5bmNFbmFibGVkKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwiY3JlYXRlXCIsIChmaWxlKSA9PiB7XG4gICAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gXCJtZFwiKSB7XG4gICAgICAgICAgICB0aGlzLmZpbGVXYXRjaGVyLm9uRmlsZUNoYW5nZShmaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgICB0aGlzLmFwcC52YXVsdC5vbihcIm1vZGlmeVwiLCAoZmlsZSkgPT4ge1xuICAgICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09IFwibWRcIikge1xuICAgICAgICAgICAgdGhpcy5maWxlV2F0Y2hlci5vbkZpbGVDaGFuZ2UoZmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBJbml0aWFsIHN5bmMgb2Ygc2hhcmVkIGRvY3NcbiAgICB0aGlzLmRvd25sb2FkZXIuc3luY1NoYXJlZERvY3VtZW50cygpO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcbiAgICBjb25zdCBsZWF2ZXMgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9URUFNKTtcbiAgICBsZXQgbGVhZiA9IGxlYXZlcy5sZW5ndGggPiAwID8gbGVhdmVzWzBdIDogbnVsbDtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIGxlYWYgPSB3b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICAgIGlmIChsZWFmKSBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRV9URUFNLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIGlmIChsZWFmKSB3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge31cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgZGF0YT8uc2V0dGluZ3MpO1xuICAgIHRoaXMuZmlsZVdhdGNoZXI/LmxvYWRDYWNoZShkYXRhPy5zeW5jQ2FjaGUgPz8ge30pO1xuICAgIHRoaXMuZG93bmxvYWRlcj8ubG9hZENhY2hlKGRhdGE/LmRvd25sb2FkQ2FjaGUgPz8ge30pO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoe1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzeW5jQ2FjaGU6IHRoaXMuZmlsZVdhdGNoZXI/LnNhdmVDYWNoZSgpID8/IHt9LFxuICAgICAgZG93bmxvYWRDYWNoZTogdGhpcy5kb3dubG9hZGVyPy5zYXZlQ2FjaGUoKSA/PyB7fSxcbiAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBQdXNoc2lkaWFuU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFB1c2hzaWRpYW5QbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogUHVzaHNpZGlhblBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIlB1c2hzaWRpYW4gU2V0dGluZ3NcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJBUEkgS2V5XCIpXG4gICAgICAuc2V0RGVzYyhcIllvdXIgUHVzaHNpZGlhbiBBUEkga2V5IGZyb20gdGhlIHdlYiBhcHBcIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwicHNrXy4uLlwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlLZXkpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5ID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJBUEkgQmFzZSBVUkxcIilcbiAgICAgIC5zZXREZXNjKFwiT3ZlcnJpZGUgdGhlIEFQSSBlbmRwb2ludFwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJodHRwczovL2FwaS5wdXNoc2lkaWFuLmNvbVwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlCYXNlVXJsKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwaUJhc2VVcmwgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk9yZ2FuaXphdGlvbiBJRFwiKVxuICAgICAgLnNldERlc2MoXCJZb3VyIHRlYW0gb3JnYW5pemF0aW9uIElEXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIm9yZ18uLi5cIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub3JnSWQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3JnSWQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkVuYWJsZSBzeW5jXCIpXG4gICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgc3luYyBzaGFyZWQgbm90ZXNcIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnN5bmNFbmFibGVkKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zeW5jRW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlIFB1c2hzaWRpYW5QbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgY2xhc3MgUHVzaHNpZGlhbkFQSSB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGx1Z2luOiBQdXNoc2lkaWFuUGx1Z2luKSB7fVxuXG4gIGdldCBiYXNlVXJsKCkge1xuICAgIHJldHVybiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlCYXNlVXJsLnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgfVxuXG4gIGdldCBoZWFkZXJzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBpS2V5fWAsXG4gICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgZ2V0RG9jdW1lbnRzKG9yZ0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2FwaS9kb2N1bWVudHM/b3JnX2lkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KG9yZ0lkKX1gLCB7XG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnMsXG4gICAgfSk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIGRvY3VtZW50czogJHtyZXMuc3RhdHVzfWApO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkRG9jdW1lbnQocGF5bG9hZDoge1xuICAgIG9yZ19pZDogc3RyaW5nO1xuICAgIHZhdWx0X2lkOiBzdHJpbmc7XG4gICAgb2JzaWRpYW5fcGF0aDogc3RyaW5nO1xuICAgIHRpdGxlPzogc3RyaW5nO1xuICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICBjb250ZW50X2hhc2g6IHN0cmluZztcbiAgICBydWxlczogeyBzdWJqZWN0X2lkOiBzdHJpbmc7IHJlbGF0aW9uOiBzdHJpbmcgfVtdO1xuICB9KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9hcGkvZG9jdW1lbnRzYCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgIH0pO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byB1cGxvYWQgZG9jdW1lbnQ6ICR7cmVzLnN0YXR1c31gKTtcbiAgICByZXR1cm4gcmVzLmpzb24oKTtcbiAgfVxuXG4gIGFzeW5jIGdldFVzZXIoKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5iYXNlVXJsfS9hcGkvdXNlci9tZWAsIHtcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVycyxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggdXNlcjogJHtyZXMuc3RhdHVzfWApO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG5cbiAgYXN5bmMgc2VhcmNoKHF1ZXJ5OiBzdHJpbmcsIG9yZ0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2FwaS9zZWFyY2hgLCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBxdWVyeSwgb3JnX2lkOiBvcmdJZCB9KSxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gc2VhcmNoOiAke3Jlcy5zdGF0dXN9YCk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH1cblxuICBhc3luYyBnZXRPcmdNZW1iZXJzKG9yZ0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmJhc2VVcmx9L2FwaS9vcmdzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG9yZ0lkKX0vbWVtYmVyc2AsIHtcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVycyxcbiAgICB9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggbWVtYmVyczogJHtyZXMuc3RhdHVzfWApO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgVEZpbGUsIE1ldGFkYXRhQ2FjaGUsIE5vdGljZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgUHVzaHNpZGlhblBsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuaW1wb3J0IHsgU2hhcmVNb2RhbCB9IGZyb20gXCIuLi91aS9zaGFyZS1tb2RhbFwiO1xuXG5pbnRlcmZhY2UgRmlsZUNhY2hlRW50cnkge1xuICBjb250ZW50SGFzaDogc3RyaW5nO1xuICBsYXN0U3luY0F0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBNZW1iZXIge1xuICBpZDogc3RyaW5nO1xuICBkaXNwbGF5X25hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVXYXRjaGVyIHtcbiAgcHJpdmF0ZSBjYWNoZTogTWFwPHN0cmluZywgRmlsZUNhY2hlRW50cnk+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHN5bmNRdWV1ZTogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG4gIHByaXZhdGUgc3luY1RpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBtZW1iZXJDYWNoZTogeyBtZW1iZXJzOiBNZW1iZXJbXTsgZmV0Y2hlZEF0OiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGx1Z2luOiBQdXNoc2lkaWFuUGx1Z2luKSB7fVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0TWVtYmVycygpOiBQcm9taXNlPE1lbWJlcltdPiB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBpZiAodGhpcy5tZW1iZXJDYWNoZSAmJiBub3cgLSB0aGlzLm1lbWJlckNhY2hlLmZldGNoZWRBdCA8IDUgKiA2MCAqIDEwMDApIHtcbiAgICAgIHJldHVybiB0aGlzLm1lbWJlckNhY2hlLm1lbWJlcnM7XG4gICAgfVxuICAgIGNvbnN0IG1lbWJlcnMgPSBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuZ2V0T3JnTWVtYmVycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcmdJZCk7XG4gICAgdGhpcy5tZW1iZXJDYWNoZSA9IHsgbWVtYmVycywgZmV0Y2hlZEF0OiBub3cgfTtcbiAgICByZXR1cm4gbWVtYmVycztcbiAgfVxuXG4gIGFzeW5jIG9uRmlsZUNoYW5nZShmaWxlOiBURmlsZSkge1xuICAgIGlmICghdGhpcy5wbHVnaW4uc2V0dGluZ3Muc3luY0VuYWJsZWQpIHJldHVybjtcbiAgICBpZiAoIXRoaXMucGx1Z2luLnNldHRpbmdzLmFwaUtleSkgcmV0dXJuO1xuICAgIGlmICghdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3JnSWQpIHJldHVybjtcblxuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5wbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuICAgIGNvbnN0IHNoYXJlVmFsdWUgPSBjYWNoZT8uZnJvbnRtYXR0ZXI/LnNoYXJlO1xuICAgIGNvbnN0IGhhc1NoYXJlID0gISFzaGFyZVZhbHVlO1xuXG4gICAgLy8gUnVuIG1lbnRpb24gZGV0ZWN0aW9uIG9uIEFMTCBtYXJrZG93biBmaWxlcywgZXZlbiBvbmVzIG5vdCB5ZXQgc2hhcmVkXG4gICAgaWYgKGZpbGUuZXh0ZW5zaW9uID09PSBcIm1kXCIpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnBsdWdpbi5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IHJ1bGVzID0gc2hhcmVWYWx1ZSA/IGF3YWl0IHRoaXMuYnVpbGRSdWxlcyhzaGFyZVZhbHVlKSA6IFtdO1xuICAgICAgdm9pZCB0aGlzLmNoZWNrTWVudGlvbnMoZmlsZSwgY29udGVudCwgcnVsZXMpO1xuICAgIH1cblxuICAgIC8vIE9ubHkgcXVldWUgc3luYyBmb3Igc2hhcmVkIGZpbGVzXG4gICAgaWYgKGhhc1NoYXJlKSB7XG4gICAgICB0aGlzLnN5bmNRdWV1ZS5hZGQoZmlsZS5wYXRoKTtcbiAgICAgIHRoaXMuc2NoZWR1bGVTeW5jKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVN5bmMoKSB7XG4gICAgaWYgKHRoaXMuc3luY1RpbWVyKSByZXR1cm47XG4gICAgdGhpcy5zeW5jVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnByb2Nlc3NRdWV1ZSgpO1xuICAgICAgdGhpcy5zeW5jVGltZXIgPSBudWxsO1xuICAgIH0sIDIwMDApOyAvLyBkZWJvdW5jZSAyc1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzUXVldWUoKSB7XG4gICAgY29uc3QgcGF0aHMgPSBBcnJheS5mcm9tKHRoaXMuc3luY1F1ZXVlKTtcbiAgICB0aGlzLnN5bmNRdWV1ZS5jbGVhcigpO1xuXG4gICAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5wbHVnaW4uYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIGNvbnRpbnVlO1xuICAgICAgYXdhaXQgdGhpcy5zeW5jRmlsZShmaWxlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHN5bmNGaWxlKGZpbGU6IFRGaWxlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnBsdWdpbi5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgIGNvbnN0IGhhc2ggPSBhd2FpdCB0aGlzLnNoYTI1Nihjb250ZW50KTtcblxuICAgICAgY29uc3QgY2FjaGVkID0gdGhpcy5jYWNoZS5nZXQoZmlsZS5wYXRoKTtcbiAgICAgIGlmIChjYWNoZWQ/LmNvbnRlbnRIYXNoID09PSBoYXNoKSByZXR1cm47IC8vIHVuY2hhbmdlZFxuXG4gICAgICBjb25zdCBjYWNoZSA9IHRoaXMucGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcbiAgICAgIGNvbnN0IHNoYXJlID0gY2FjaGU/LmZyb250bWF0dGVyPy5zaGFyZTtcbiAgICAgIGNvbnN0IHJ1bGVzID0gYXdhaXQgdGhpcy5idWlsZFJ1bGVzKHNoYXJlKTtcblxuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uYXBpLnVwbG9hZERvY3VtZW50KHtcbiAgICAgICAgb3JnX2lkOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcmdJZCxcbiAgICAgICAgdmF1bHRfaWQ6IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXROYW1lKCksXG4gICAgICAgIG9ic2lkaWFuX3BhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgdGl0bGU6IGNhY2hlPy5mcm9udG1hdHRlcj8udGl0bGUgfHwgZmlsZS5iYXNlbmFtZSxcbiAgICAgICAgY29udGVudCxcbiAgICAgICAgY29udGVudF9oYXNoOiBoYXNoLFxuICAgICAgICBydWxlcyxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmNhY2hlLnNldChmaWxlLnBhdGgsIHsgY29udGVudEhhc2g6IGhhc2gsIGxhc3RTeW5jQXQ6IERhdGUubm93KCkgfSk7XG4gICAgICBjb25zb2xlLmxvZyhgW1B1c2hzaWRpYW5dIFN5bmNlZDogJHtmaWxlLnBhdGh9YCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbUHVzaHNpZGlhbl0gRmFpbGVkIHRvIHN5bmMgJHtmaWxlLnBhdGh9OmAsIGVycik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjaGVja01lbnRpb25zKGZpbGU6IFRGaWxlLCBjb250ZW50OiBzdHJpbmcsIHJ1bGVzOiB7IHN1YmplY3RfaWQ6IHN0cmluZyB9W10pIHtcbiAgICBjb25zdCBtZW50aW9uUmVnZXggPSAvQChbQS1aYS16MC05X117Miw0MH0pL2c7XG4gICAgY29uc3QgbWVudGlvbnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBsZXQgbWF0Y2g7XG4gICAgd2hpbGUgKChtYXRjaCA9IG1lbnRpb25SZWdleC5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xuICAgICAgbWVudGlvbnMuYWRkKG1hdGNoWzFdLnRyaW0oKS50b0xvd2VyQ2FzZSgpKTtcbiAgICB9XG4gICAgaWYgKG1lbnRpb25zLnNpemUgPT09IDApIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBtZW1iZXJzID0gYXdhaXQgdGhpcy5nZXRNZW1iZXJzKCk7XG4gICAgICBjb25zdCBjdXJyZW50U3ViamVjdHMgPSBuZXcgU2V0KHJ1bGVzLm1hcCgocikgPT4gci5zdWJqZWN0X2lkKSk7XG4gICAgICBjb25zdCBwZW5kaW5nOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3QgbWVudGlvbldvcmRzID0gQXJyYXkuZnJvbShtZW50aW9ucyk7XG5cbiAgICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIG1lbWJlcnMpIHtcbiAgICAgICAgaWYgKCFtZW1iZXIuZGlzcGxheV9uYW1lPy50cmltKCkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBuYW1lTG93ZXIgPSBtZW1iZXIuZGlzcGxheV9uYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IG5hbWVUb2tlbnMgPSBuYW1lTG93ZXIuc3BsaXQoL1xccysvKTtcbiAgICAgICAgY29uc3QgaXNNZW50aW9uZWQgPSBtZW50aW9uV29yZHMuc29tZShcbiAgICAgICAgICAobSkgPT4gbmFtZUxvd2VyID09PSBtIHx8IG5hbWVUb2tlbnMuaW5jbHVkZXMobSlcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGlzTWVudGlvbmVkICYmICFjdXJyZW50U3ViamVjdHMuaGFzKG1lbWJlci5pZCkpIHtcbiAgICAgICAgICBwZW5kaW5nLnB1c2gobWVtYmVyLmlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIE1lcmdlIHdpdGggYW55IGV4aXN0aW5nIHBlbmRpbmcgbWVudGlvbnMgc28gc3RhdGUgYWNjdW11bGF0ZXNcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSAodGhpcy5wbHVnaW4gYXMgYW55KS5fX3BlbmRpbmdNZW50aW9ucyB8fCBbXTtcbiAgICAgICAgY29uc3QgbWVyZ2VkID0gQXJyYXkuZnJvbShuZXcgU2V0KFsuLi5leGlzdGluZywgLi4ucGVuZGluZ10pKTtcbiAgICAgICAgKHRoaXMucGx1Z2luIGFzIGFueSkuX19wZW5kaW5nTWVudGlvbnMgPSBtZXJnZWQ7XG5cbiAgICAgICAgLy8gU2tpcCBpZiB3ZSBqdXN0IHNhdmVkIChwcm9jZXNzRnJvbnRNYXR0ZXIgdHJpZ2dlcnMgYSBmaWxlIGNoYW5nZSlcbiAgICAgICAgY29uc3QgZ3JhY2UgPSAodGhpcy5wbHVnaW4gYXMgYW55KS5fX3NoYXJlU2F2ZUdyYWNlO1xuICAgICAgICBpZiAoZ3JhY2UgJiYgRGF0ZS5ub3coKSAtIGdyYWNlIDwgMjAwMCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIE9wZW4gdGhlIHNoYXJlIG1vZGFsIGRpcmVjdGx5IHdpdGggcGVuZGluZyBwcmUtY2hlY2tlZFxuICAgICAgICAvLyAoc2tpcCBpZiBhbHJlYWR5IG9wZW4gdG8gYXZvaWQgc3RhY2tpbmcgbW9kYWxzKVxuICAgICAgICBpZiAoISh0aGlzLnBsdWdpbiBhcyBhbnkpLl9fc2hhcmVNb2RhbE9wZW4pIHtcbiAgICAgICAgICAodGhpcy5wbHVnaW4gYXMgYW55KS5fX3NoYXJlTW9kYWxPcGVuID0gdHJ1ZTtcbiAgICAgICAgICBjb25zdCBtb2RhbCA9IG5ldyBTaGFyZU1vZGFsKHRoaXMucGx1Z2luLmFwcCwgdGhpcy5wbHVnaW4sIGZpbGUsIG1lcmdlZCk7XG4gICAgICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBTaWxlbnRseSBmYWlsIG1lbnRpb24gZGV0ZWN0aW9uXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBidWlsZFJ1bGVzKHNoYXJlOiBib29sZWFuIHwgc3RyaW5nIHwgc3RyaW5nW10pOiBQcm9taXNlPHsgc3ViamVjdF9pZDogc3RyaW5nOyByZWxhdGlvbjogc3RyaW5nIH1bXT4ge1xuICAgIGlmIChzaGFyZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIFt7IHN1YmplY3RfaWQ6IFwiZXZlcnlvbmVcIiwgcmVsYXRpb246IFwicmVhZGVyXCIgfV07XG4gICAgfVxuICAgIGNvbnN0IGl0ZW1zID0gQXJyYXkuaXNBcnJheShzaGFyZSkgPyBzaGFyZSA6IFtzaGFyZV07XG4gICAgY29uc3QgbWVtYmVycyA9IGF3YWl0IHRoaXMuZ2V0TWVtYmVycygpO1xuXG4gICAgcmV0dXJuIGl0ZW1zXG4gICAgICAuZmlsdGVyKChzKSA9PiB0eXBlb2YgcyA9PT0gXCJzdHJpbmdcIilcbiAgICAgIC5tYXAoKHMpID0+IHtcbiAgICAgICAgY29uc3QgbG93ZXIgPSBzLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChsb3dlciA9PT0gXCJldmVyeW9uZVwiKSB7XG4gICAgICAgICAgcmV0dXJuIHsgc3ViamVjdF9pZDogXCJldmVyeW9uZVwiLCByZWxhdGlvbjogXCJyZWFkZXJcIiBhcyBjb25zdCB9O1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlc29sdmUgZGlzcGxheSBuYW1lIHRvIG1lbWJlciBJRFxuICAgICAgICBjb25zdCBtZW1iZXIgPSBtZW1iZXJzLmZpbmQoKG0pID0+IG0uZGlzcGxheV9uYW1lPy50b0xvd2VyQ2FzZSgpID09PSBsb3dlcik7XG4gICAgICAgIGlmIChtZW1iZXIpIHtcbiAgICAgICAgICByZXR1cm4geyBzdWJqZWN0X2lkOiBtZW1iZXIuaWQsIHJlbGF0aW9uOiBcInJlYWRlclwiIGFzIGNvbnN0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS53YXJuKGBbUHVzaHNpZGlhbl0gQ291bGQgbm90IHJlc29sdmUgc2hhcmUgdGFyZ2V0IFwiJHtzfVwiIHRvIGEgbWVtYmVyIFx1MjAxNCBzaGFyaW5nIHJ1bGUgd2lsbCBiZSBza2lwcGVkLmApO1xuICAgICAgICAvLyBGYWxsYmFjazogdHJlYXQgYXMgcmF3IElEIChiYWNrd2FyZCBjb21wYXQpXG4gICAgICAgIHJldHVybiB7IHN1YmplY3RfaWQ6IHMsIHJlbGF0aW9uOiBcInJlYWRlclwiIGFzIGNvbnN0IH07XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgc2hhMjU2KGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgYnVmID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGNvbnRlbnQpO1xuICAgIGNvbnN0IGhhc2ggPSBhd2FpdCBjcnlwdG8uc3VidGxlLmRpZ2VzdChcIlNIQS0yNTZcIiwgYnVmKTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShuZXcgVWludDhBcnJheShoYXNoKSlcbiAgICAgIC5tYXAoKGIpID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKSlcbiAgICAgIC5qb2luKFwiXCIpO1xuICB9XG5cbiAgbG9hZENhY2hlKGRhdGE6IFJlY29yZDxzdHJpbmcsIEZpbGVDYWNoZUVudHJ5Pikge1xuICAgIHRoaXMuY2FjaGUgPSBuZXcgTWFwKE9iamVjdC5lbnRyaWVzKGRhdGEpKTtcbiAgfVxuXG4gIHNhdmVDYWNoZSgpOiBSZWNvcmQ8c3RyaW5nLCBGaWxlQ2FjaGVFbnRyeT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXModGhpcy5jYWNoZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBNb2RhbCwgU2V0dGluZywgVEZpbGUsIE5vdGljZSwgVGV4dENvbXBvbmVudCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgUHVzaHNpZGlhblBsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuXG5pbnRlcmZhY2UgTWVtYmVyIHtcbiAgaWQ6IHN0cmluZztcbiAgZGlzcGxheV9uYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTaGFyZU1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBwcml2YXRlIG1lbWJlcnM6IE1lbWJlcltdID0gW107XG4gIHByaXZhdGUgZmlsdGVyZWQ6IE1lbWJlcltdID0gW107XG4gIHByaXZhdGUgY3VycmVudFNoYXJlOiBzdHJpbmdbXSA9IFtdOyAvLyBzdG9yZXMgZGlzcGxheSBuYW1lc1xuICBwcml2YXRlIHNoYXJlV2l0aEV2ZXJ5b25lID0gZmFsc2U7XG4gIHByaXZhdGUgc2VhcmNoSW5wdXQ6IFRleHRDb21wb25lbnQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IGFueSxcbiAgICBwcml2YXRlIHBsdWdpbjogUHVzaHNpZGlhblBsdWdpbixcbiAgICBwcml2YXRlIGZpbGU6IFRGaWxlLFxuICAgIHByaXZhdGUgcGVuZGluZ01lbnRpb25zOiBzdHJpbmdbXSA9IFtdXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIlNoYXJlIG5vdGVcIiB9KTtcblxuICAgIC8vIFJlYWQgY3VycmVudCBmcm9udG1hdHRlciAoc3RvcmUgaHVtYW4gbmFtZXMsIG5vdCBJRHMpXG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLnBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUodGhpcy5maWxlKTtcbiAgICBjb25zdCBzaGFyZSA9IGNhY2hlPy5mcm9udG1hdHRlcj8uc2hhcmU7XG4gICAgaWYgKHNoYXJlID09PSB0cnVlKSB7XG4gICAgICB0aGlzLnNoYXJlV2l0aEV2ZXJ5b25lID0gdHJ1ZTtcbiAgICAgIHRoaXMuY3VycmVudFNoYXJlID0gW107XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHNoYXJlKSkge1xuICAgICAgdGhpcy5jdXJyZW50U2hhcmUgPSBzaGFyZS5maWx0ZXIoKHM6IHVua25vd24pID0+IHR5cGVvZiBzID09PSBcInN0cmluZ1wiKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzaGFyZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy5jdXJyZW50U2hhcmUgPSBbc2hhcmVdO1xuICAgIH1cblxuICAgIC8vIEZldGNoIG9yZyBtZW1iZXJzXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubWVtYmVycyA9IChhd2FpdCB0aGlzLnBsdWdpbi5hcGkuZ2V0T3JnTWVtYmVycyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcmdJZCkpXG4gICAgICAgIC5maWx0ZXIoKG06IE1lbWJlcikgPT4gbS5kaXNwbGF5X25hbWU/LnRyaW0oKS5sZW5ndGggPiAwKTtcbiAgICAgIHRoaXMuZmlsdGVyZWQgPSB0aGlzLm1lbWJlcnM7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogXCJGYWlsZWQgdG8gbG9hZCB0ZWFtIG1lbWJlcnMuIENoZWNrIHlvdXIgQVBJIHNldHRpbmdzLlwiLFxuICAgICAgICBjbHM6IFwidGV4dC1lcnJvclwiLFxuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gTWlncmF0ZSBhbnkgcmF3IElEcyBpbiBjdXJyZW50U2hhcmUgdG8gZGlzcGxheSBuYW1lc1xuICAgIHRoaXMuY3VycmVudFNoYXJlID0gdGhpcy5jdXJyZW50U2hhcmUubWFwKChzKSA9PiB7XG4gICAgICBjb25zdCBtZW1iZXIgPSB0aGlzLm1lbWJlcnMuZmluZCgobSkgPT4gbS5pZCA9PT0gcyB8fCBtLmRpc3BsYXlfbmFtZS50b0xvd2VyQ2FzZSgpID09PSBzLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgcmV0dXJuIG1lbWJlciA/IG1lbWJlci5kaXNwbGF5X25hbWUgOiBzO1xuICAgIH0pO1xuXG4gICAgLy8gQXV0by10b2dnbGUgb24gYW55IHBlbmRpbmcgQG1lbnRpb25zIHNvIHRoZXkgc3RhcnQgY2hlY2tlZFxuICAgIGNvbnN0IHBlbmRpbmdOYW1lcyA9IHRoaXMubWVtYmVyc1xuICAgICAgLmZpbHRlcigobSkgPT4gdGhpcy5wZW5kaW5nTWVudGlvbnMuaW5jbHVkZXMobS5pZCkpXG4gICAgICAubWFwKChtKSA9PiBtLmRpc3BsYXlfbmFtZSlcbiAgICAgIC5maWx0ZXIoKG5hbWUpID0+ICF0aGlzLmN1cnJlbnRTaGFyZS5zb21lKChzKSA9PiBzLnRvTG93ZXJDYXNlKCkgPT09IG5hbWUudG9Mb3dlckNhc2UoKSkpO1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBwZW5kaW5nTmFtZXMpIHtcbiAgICAgIHRoaXMuY3VycmVudFNoYXJlLnB1c2gobmFtZSk7XG4gICAgfVxuXG4gICAgLy8gRXZlcnlvbmUgdG9nZ2xlXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoXCJTaGFyZSB3aXRoIGV2ZXJ5b25lIGluIG9yZ1wiKVxuICAgICAgLnNldERlc2MoXCJBbnlvbmUgaW4geW91ciBvcmdhbml6YXRpb24gY2FuIHNlZSB0aGlzIG5vdGUuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNoYXJlV2l0aEV2ZXJ5b25lKS5vbkNoYW5nZSgodmFsKSA9PiB7XG4gICAgICAgICAgdGhpcy5zaGFyZVdpdGhFdmVyeW9uZSA9IHZhbDtcbiAgICAgICAgICB0aGlzLnJlbmRlck1lbWJlckxpc3QoKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAvLyBTZWFyY2hcbiAgICBjb25zdCBzZWFyY2hTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoXCJGaW5kIHBlb3BsZVwiKVxuICAgICAgLnNldENsYXNzKFwicHVzaHNpZGlhbi1zZWFyY2hcIik7XG4gICAgc2VhcmNoU2V0dGluZy5hZGRTZWFyY2goKHNlYXJjaCkgPT4ge1xuICAgICAgdGhpcy5zZWFyY2hJbnB1dCA9IHNlYXJjaCBhcyB1bmtub3duIGFzIFRleHRDb21wb25lbnQ7XG4gICAgICBzZWFyY2guc2V0UGxhY2Vob2xkZXIoXCJUeXBlIEBuYW1lIHRvIGZpbHRlci4uLlwiKTtcbiAgICAgIHNlYXJjaC5vbkNoYW5nZSgodmFsKSA9PiB7XG4gICAgICAgIGNvbnN0IHEgPSB2YWwudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9eQC8sIFwiXCIpO1xuICAgICAgICB0aGlzLmZpbHRlcmVkID0gcVxuICAgICAgICAgID8gdGhpcy5tZW1iZXJzLmZpbHRlcigobSkgPT4gbS5kaXNwbGF5X25hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSlcbiAgICAgICAgICA6IHRoaXMubWVtYmVycztcbiAgICAgICAgdGhpcy5yZW5kZXJNZW1iZXJMaXN0KCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIE1lbWJlciBsaXN0IGNvbnRhaW5lclxuICAgIGNvbnN0IGxpc3RFbCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwicHVzaHNpZGlhbi1tZW1iZXItbGlzdFwiIH0pO1xuICAgIGxpc3RFbC5pZCA9IFwicHVzaHNpZGlhbi1tZW1iZXItbGlzdFwiO1xuICAgIGxpc3RFbC5zdHlsZS5wYWRkaW5nQm90dG9tID0gXCI4cHhcIjtcblxuICAgIHRoaXMucmVuZGVyTWVtYmVyTGlzdCgpO1xuXG4gICAgLy8gQWN0aW9ucyBcdTIwMTQgU2F2ZSArIENhbmNlbCBvbiBvbmUgcm93XG4gICAgY29uc3QgYWN0aW9uUm93ID0gbmV3IFNldHRpbmcoY29udGVudEVsKTtcbiAgICBhY3Rpb25Sb3cuYWRkQnV0dG9uKChidG4pID0+XG4gICAgICBidG5cbiAgICAgICAgLnNldEJ1dHRvblRleHQoXCJTYXZlXCIpXG4gICAgICAgIC5zZXRDdGEoKVxuICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLnNhdmUoKSlcbiAgICApO1xuICAgIGFjdGlvblJvdy5hZGRCdXR0b24oKGJ0bikgPT5cbiAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KFwiQ2FuY2VsXCIpLm9uQ2xpY2soKCkgPT4gdGhpcy5jbG9zZSgpKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlck1lbWJlckxpc3QoKSB7XG4gICAgY29uc3QgbGlzdEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIiNwdXNoc2lkaWFuLW1lbWJlci1saXN0XCIpIGFzIEhUTUxFbGVtZW50O1xuICAgIGlmICghbGlzdEVsKSByZXR1cm47XG4gICAgbGlzdEVsLmVtcHR5KCk7XG5cbiAgICBpZiAodGhpcy5zaGFyZVdpdGhFdmVyeW9uZSkge1xuICAgICAgbGlzdEVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiU2hhcmluZyB3aXRoIGV2ZXJ5b25lIFx1MjAxNCBzcGVjaWZpYyBwZW9wbGUgaGlkZGVuLlwiLCBjbHM6IFwidGV4dC1zbSB0ZXh0LWdyYXktNDAwIGl0YWxpY1wiIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZpbHRlcmVkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbGlzdEVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiTm8gbWVtYmVycyBtYXRjaCB5b3VyIHNlYXJjaC5cIiwgY2xzOiBcInRleHQtc20gdGV4dC1ncmF5LTQwMFwiIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIHRoaXMuZmlsdGVyZWQpIHtcbiAgICAgIGlmICghbWVtYmVyLmRpc3BsYXlfbmFtZT8udHJpbSgpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGlzQ2hlY2tlZCA9IHRoaXMuY3VycmVudFNoYXJlLnNvbWUoXG4gICAgICAgIChzKSA9PiBzLnRvTG93ZXJDYXNlKCkgPT09IG1lbWJlci5kaXNwbGF5X25hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgKTtcbiAgICAgIGNvbnN0IHJvdyA9IG5ldyBTZXR0aW5nKGxpc3RFbClcbiAgICAgICAgLnNldE5hbWUobWVtYmVyLmRpc3BsYXlfbmFtZSlcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgIHRvZ2dsZS5zZXRWYWx1ZShpc0NoZWNrZWQpLm9uQ2hhbmdlKCh2YWwpID0+IHtcbiAgICAgICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50U2hhcmUucHVzaChtZW1iZXIuZGlzcGxheV9uYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudFNoYXJlID0gdGhpcy5jdXJyZW50U2hhcmUuZmlsdGVyKFxuICAgICAgICAgICAgICAgIChzKSA9PiBzLnRvTG93ZXJDYXNlKCkgIT09IG1lbWJlci5kaXNwbGF5X25hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICAvLyBUaWdodGVuIHNwYWNpbmc6IHJlbW92ZSBleHRyYSBib3R0b20gbWFyZ2luIG9uIGxhc3Qgcm93XG4gICAgICByb3cuc2V0dGluZ0VsLnN0eWxlLm1hcmdpbkJvdHRvbSA9IFwiMFwiO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNhdmUoKSB7XG4gICAgLy8gR3JhY2UgcGVyaW9kOiBwcmV2ZW50IG1lbnRpb24gZGV0ZWN0aW9uIGZyb20gcmVvcGVuaW5nIHRoZSBtb2RhbFxuICAgIC8vIHdoaWxlIHByb2Nlc3NGcm9udE1hdHRlciB0cmlnZ2VycyBhIGZpbGUtY2hhbmdlIGV2ZW50XG4gICAgKHRoaXMucGx1Z2luIGFzIGFueSkuX19zaGFyZVNhdmVHcmFjZSA9IERhdGUubm93KCk7XG4gICAgYXdhaXQgdGhpcy5wbHVnaW4uYXBwLmZpbGVNYW5hZ2VyLnByb2Nlc3NGcm9udE1hdHRlcih0aGlzLmZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgICAgaWYgKHRoaXMuc2hhcmVXaXRoRXZlcnlvbmUpIHtcbiAgICAgICAgZnJvbnRtYXR0ZXIuc2hhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnRTaGFyZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZGVsZXRlIGZyb250bWF0dGVyLnNoYXJlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnRTaGFyZS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZnJvbnRtYXR0ZXIuc2hhcmUgPSB0aGlzLmN1cnJlbnRTaGFyZVswXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyb250bWF0dGVyLnNoYXJlID0gdGhpcy5jdXJyZW50U2hhcmU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBuZXcgTm90aWNlKFwiU2hhcmluZyBydWxlcyB1cGRhdGVkIFx1MjAxNCBub3RlIHdpbGwgc3luYyBzaG9ydGx5XCIpO1xuICAgIC8vIENsZWFyIHBlbmRpbmcgbWVudGlvbnMgbm93IHRoYXQgdGhleSd2ZSBiZWVuIGNvbW1pdHRlZFxuICAgIGRlbGV0ZSAodGhpcy5wbHVnaW4gYXMgYW55KS5fX3BlbmRpbmdNZW50aW9ucztcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cblxuICBvbkNsb3NlKCkge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgKHRoaXMucGx1Z2luIGFzIGFueSkuX19zaGFyZU1vZGFsT3BlbiA9IGZhbHNlO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgVEZpbGUsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIFB1c2hzaWRpYW5QbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcblxuaW50ZXJmYWNlIFJlbW90ZURvY3VtZW50IHtcbiAgaWQ6IHN0cmluZztcbiAgb2JzaWRpYW5fcGF0aDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nIHwgbnVsbDtcbiAgb3duZXJfaWQ6IHN0cmluZztcbiAgb3duZXJfbmFtZTogc3RyaW5nO1xuICBvcmdfbmFtZTogc3RyaW5nO1xuICB2ZXJzaW9uOiBudW1iZXI7XG4gIHVwZGF0ZWRfYXQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIERvd25sb2FkQ2FjaGVFbnRyeSB7XG4gIHZlcnNpb246IG51bWJlcjtcbiAgc3luY2VkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIERvd25sb2FkZXIge1xuICBwcml2YXRlIGNhY2hlOiBNYXA8c3RyaW5nLCBEb3dubG9hZENhY2hlRW50cnk+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHVzZXJJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwbHVnaW46IFB1c2hzaWRpYW5QbHVnaW4pIHt9XG5cbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVVc2VySWQoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgaWYgKHRoaXMudXNlcklkKSByZXR1cm4gdGhpcy51c2VySWQ7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0aGlzLnBsdWdpbi5hcGkuZ2V0VXNlcigpO1xuICAgICAgdGhpcy51c2VySWQgPSB1c2VyLmlkO1xuICAgICAgcmV0dXJuIHRoaXMudXNlcklkO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc3luY1NoYXJlZERvY3VtZW50cygpIHtcbiAgICBpZiAoIXRoaXMucGx1Z2luLnNldHRpbmdzLnN5bmNFbmFibGVkKSByZXR1cm47XG4gICAgaWYgKCF0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcGlLZXkpIHJldHVybjtcbiAgICBpZiAoIXRoaXMucGx1Z2luLnNldHRpbmdzLm9yZ0lkKSByZXR1cm47XG5cbiAgICBjb25zdCBjdXJyZW50VXNlcklkID0gYXdhaXQgdGhpcy5lbnN1cmVVc2VySWQoKTtcbiAgICBpZiAoIWN1cnJlbnRVc2VySWQpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIltQdXNoc2lkaWFuXSBDYW5ub3Qgc3luYzogZmFpbGVkIHRvIHJlc29sdmUgY3VycmVudCB1c2VyXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkb2NzOiBSZW1vdGVEb2N1bWVudFtdID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBpLmdldERvY3VtZW50cyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcmdJZCk7XG5cbiAgICAgIGZvciAoY29uc3QgZG9jIG9mIGRvY3MpIHtcbiAgICAgICAgLy8gU2tpcCBvd24gZG9jdW1lbnRzICh0aGV5J3JlIGFscmVhZHkgaW4gdGhlIHZhdWx0KVxuICAgICAgICBpZiAoZG9jLm93bmVyX2lkID09PSBjdXJyZW50VXNlcklkKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmNhY2hlLmdldChkb2MuaWQpO1xuICAgICAgICBpZiAoY2FjaGVkICYmIGNhY2hlZC52ZXJzaW9uID49IGRvYy52ZXJzaW9uKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCBvcmdTbHVnID0gKGRvYy5vcmdfbmFtZSB8fCBcIlNoYXJlZFwiKS5yZXBsYWNlKC9bXmEtekEtWjAtOVxccy1dL2csIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgY29uc3Qgb3duZXJTbHVnID0gKGRvYy5vd25lcl9uYW1lIHx8IFwidW5rbm93blwiKS5yZXBsYWNlKC9bXmEtekEtWjAtOVxccy1dL2csIFwiXCIpLnRyaW0oKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGAke29yZ1NsdWd9LyR7b3duZXJTbHVnfS8ke2RvYy5vYnNpZGlhbl9wYXRofWA7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoKHRhcmdldFBhdGgpO1xuICAgICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXplZCk7XG5cbiAgICAgICAgLy8gRmV0Y2ggY29udGVudCB0aHJvdWdoIEFQSSBwcm94eSAoYXZvaWRzIENPUlMgb24gcHJlLXNpZ25lZCBSMiBVUkxzKVxuICAgICAgICBjb25zdCBjb250ZW50UmVzID0gYXdhaXQgZmV0Y2goYCR7dGhpcy5wbHVnaW4uYXBpLmJhc2VVcmx9L2FwaS9kb2N1bWVudHMvJHtkb2MuaWR9L2NvbnRlbnRgLCB7XG4gICAgICAgICAgaGVhZGVyczogdGhpcy5wbHVnaW4uYXBpLmhlYWRlcnMsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWNvbnRlbnRSZXMub2spIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgY29udGVudFJlcy50ZXh0KCk7XG5cbiAgICAgICAgaWYgKGV4aXN0aW5nIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5hcHAudmF1bHQubW9kaWZ5KGV4aXN0aW5nLCBjb250ZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZURpcmVjdG9yeShub3JtYWxpemVkKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5hcHAudmF1bHQuY3JlYXRlKG5vcm1hbGl6ZWQsIGNvbnRlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jYWNoZS5zZXQoZG9jLmlkLCB7IHZlcnNpb246IGRvYy52ZXJzaW9uLCBzeW5jZWRBdDogRGF0ZS5ub3coKSB9KTtcbiAgICAgICAgY29uc29sZS5sb2coYFtQdXNoc2lkaWFuXSBEb3dubG9hZGVkIHNoYXJlZCBkb2M6ICR7ZG9jLm9ic2lkaWFuX3BhdGh9ICh2JHtkb2MudmVyc2lvbn0pYCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiW1B1c2hzaWRpYW5dIEZhaWxlZCB0byBzeW5jIHNoYXJlZCBkb2NzOlwiLCBlcnIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZW5zdXJlRGlyZWN0b3J5KGZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICBjb25zdCBwYXJ0cyA9IGZpbGVQYXRoLnNwbGl0KFwiL1wiKTtcbiAgICBwYXJ0cy5wb3AoKTsgLy8gcmVtb3ZlIGZpbGVuYW1lXG4gICAgbGV0IGN1cnJlbnQgPSBcIlwiO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgY3VycmVudCA9IGN1cnJlbnQgPyBgJHtjdXJyZW50fS8ke3BhcnR9YCA6IHBhcnQ7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY3VycmVudCk7XG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIoY3VycmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbG9hZENhY2hlKGRhdGE6IFJlY29yZDxzdHJpbmcsIERvd25sb2FkQ2FjaGVFbnRyeT4pIHtcbiAgICB0aGlzLmNhY2hlID0gbmV3IE1hcChPYmplY3QuZW50cmllcyhkYXRhKSk7XG4gIH1cblxuICBzYXZlQ2FjaGUoKTogUmVjb3JkPHN0cmluZywgRG93bmxvYWRDYWNoZUVudHJ5PiB7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyh0aGlzLmNhY2hlKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXNHOzs7QUNFL0YsSUFBTSxnQkFBTixNQUFvQjtBQUFBLEVBQ3pCLFlBQW9CLFFBQTBCO0FBQTFCO0FBQUEs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
