var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
    __publicField(this, "members", []);
    __publicField(this, "filtered", []);
    __publicField(this, "currentShare", []);
    // stores display names
    __publicField(this, "shareWithEveryone", false);
    __publicField(this, "searchInput", null);
  }
  async onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Share note" });
    const cache = this.plugin.app.metadataCache.getFileCache(this.file);
    const share = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.share;
    if (share === true) {
      this.shareWithEveryone = true;
      this.currentShare = [];
    } else if (Array.isArray(share)) {
      this.currentShare = share.filter((s) => typeof s === "string");
    } else if (typeof share === "string") {
      this.currentShare = [share];
    }
    try {
      this.members = (await this.plugin.api.getOrgMembers(this.plugin.settings.orgId)).filter((m) => {
        var _a2;
        return ((_a2 = m.display_name) == null ? void 0 : _a2.trim().length) > 0;
      });
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
    var _a;
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
      if (!((_a = member.display_name) == null ? void 0 : _a.trim())) continue;
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
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "syncQueue", /* @__PURE__ */ new Set());
    __publicField(this, "syncTimer", null);
    __publicField(this, "memberCache", null);
  }
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
    var _a;
    if (!this.plugin.settings.syncEnabled) return;
    if (!this.plugin.settings.apiKey) return;
    if (!this.plugin.settings.orgId) return;
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const shareValue = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.share;
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
    var _a, _b;
    try {
      const content = await this.plugin.app.vault.read(file);
      const hash = await this.sha256(content);
      const cached = this.cache.get(file.path);
      if ((cached == null ? void 0 : cached.contentHash) === hash) return;
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      const share = (_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.share;
      const rules = await this.buildRules(share);
      await this.plugin.api.uploadDocument({
        org_id: this.plugin.settings.orgId,
        vault_id: this.plugin.app.vault.getName(),
        obsidian_path: file.path,
        title: ((_b = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _b.title) || file.basename,
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
    var _a;
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
        if (!((_a = member.display_name) == null ? void 0 : _a.trim())) continue;
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
    } catch (e) {
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
      const member = members.find((m) => {
        var _a;
        return ((_a = m.display_name) == null ? void 0 : _a.toLowerCase()) === lower;
      });
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
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "userId", null);
  }
  async ensureUserId() {
    if (this.userId) return this.userId;
    try {
      const user = await this.plugin.api.getUser();
      this.userId = user.id;
      return this.userId;
    } catch (e) {
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
  constructor() {
    super(...arguments);
    __publicField(this, "settings");
    __publicField(this, "api");
    __publicField(this, "fileWatcher");
    __publicField(this, "downloader");
  }
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
    var _a, _b, _c, _d;
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data == null ? void 0 : data.settings);
    (_b = this.fileWatcher) == null ? void 0 : _b.loadCache((_a = data == null ? void 0 : data.syncCache) != null ? _a : {});
    (_d = this.downloader) == null ? void 0 : _d.loadCache((_c = data == null ? void 0 : data.downloadCache) != null ? _c : {});
  }
  async saveSettings() {
    var _a, _b, _c, _d;
    await this.saveData({
      settings: this.settings,
      syncCache: (_b = (_a = this.fileWatcher) == null ? void 0 : _a.saveCache()) != null ? _b : {},
      downloadCache: (_d = (_c = this.downloader) == null ? void 0 : _c.saveCache()) != null ? _d : {}
    });
  }
};
var PushsidianSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
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
