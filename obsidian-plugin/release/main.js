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
var import_obsidian3 = require("obsidian");

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
};

// src/sync/file-watcher.ts
var import_obsidian = require("obsidian");
var FileWatcher = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  cache = /* @__PURE__ */ new Map();
  syncQueue = /* @__PURE__ */ new Set();
  syncTimer = null;
  async onFileChange(file) {
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter?.share) return;
    this.syncQueue.add(file.path);
    this.scheduleSync();
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
      if (!(file instanceof import_obsidian.TFile)) continue;
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
      const rules = this.buildRules(share);
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
  buildRules(share) {
    const items = Array.isArray(share) ? share : [share];
    return items.filter((s) => typeof s === "string").map((s) => ({
      subject_id: String(s),
      relation: "reader"
    }));
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
var import_obsidian2 = require("obsidian");
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
        const normalized = (0, import_obsidian2.normalizePath)(targetPath);
        const existing = this.plugin.app.vault.getAbstractFileByPath(normalized);
        const contentRes = await fetch(`${this.plugin.api.baseUrl}/api/documents/${doc.id}/content`, {
          headers: this.plugin.api.headers
        });
        if (!contentRes.ok) continue;
        const content = await contentRes.text();
        if (existing instanceof import_obsidian2.TFile) {
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
var ShareModal = class extends import_obsidian3.Modal {
  constructor(app) {
    super(app);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Share Note" });
    contentEl.createEl("p", { text: "Share this note with your team." });
    new import_obsidian3.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Share").setCta().onClick(() => {
        new import_obsidian3.Notice("Sharing not yet implemented");
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TeamPanelView = class extends import_obsidian3.ItemView {
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
var PushsidianPlugin = class extends import_obsidian3.Plugin {
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
      new ShareModal(this.app).open();
    });
    this.addCommand({
      id: "share-note",
      name: "Share current note",
      editorCallback: () => {
        new ShareModal(this.app).open();
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
        new import_obsidian3.Notice("Shared documents synced");
      }
    });
    this.addSettingTab(new PushsidianSettingTab(this.app, this));
    if (this.settings.syncEnabled) {
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof import_obsidian3.TFile && file.extension === "md") {
            this.fileWatcher.onFileChange(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof import_obsidian3.TFile && file.extension === "md") {
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
var PushsidianSettingTab = class extends import_obsidian3.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Pushsidian Settings" });
    new import_obsidian3.Setting(containerEl).setName("API Key").setDesc("Your Pushsidian API key from the web app").addText(
      (text) => text.setPlaceholder("psk_...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("API Base URL").setDesc("Override the API endpoint").addText(
      (text) => text.setPlaceholder("https://api.pushsidian.com").setValue(this.plugin.settings.apiBaseUrl).onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Organization ID").setDesc("Your team organization ID").addText(
      (text) => text.setPlaceholder("org_...").setValue(this.plugin.settings.orgId).onChange(async (value) => {
        this.plugin.settings.orgId = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Enable sync").setDesc("Automatically sync shared notes").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncEnabled).onChange(async (value) => {
        this.plugin.settings.syncEnabled = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
