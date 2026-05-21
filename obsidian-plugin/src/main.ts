import { Plugin, TFile, Notice, Modal, App, Setting, ItemView, WorkspaceLeaf } from "obsidian";
import { PushsidianAPI } from "./api";
import { FileWatcher } from "./sync/file-watcher";
import { Downloader } from "./sync/downloader";

const VIEW_TYPE_TEAM = "pushsidian-team-panel";

export interface PushsidianSettings {
  apiKey: string;
  apiBaseUrl: string;
  orgId: string;
  syncEnabled: boolean;
}

const DEFAULT_SETTINGS: PushsidianSettings = {
  apiKey: "",
  apiBaseUrl: "https://api.pushsidian.com",
  orgId: "",
  syncEnabled: true,
};

class ShareModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Share Note" });
    contentEl.createEl("p", { text: "Share this note with your team." });
    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Share").setCta().onClick(() => {
        new Notice("Sharing not yet implemented");
        this.close();
      })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class TeamPanelView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
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
}

export default class PushsidianPlugin extends Plugin {
  settings: PushsidianSettings;
  api: PushsidianAPI;
  fileWatcher: FileWatcher;
  downloader: Downloader;

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
      },
    });

    this.registerView(VIEW_TYPE_TEAM, (leaf) => new TeamPanelView(leaf));

    this.addCommand({
      id: "open-team-panel",
      name: "Open team knowledge panel",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "sync-shared-docs",
      name: "Sync shared documents now",
      callback: async () => {
        await this.downloader.syncSharedDocuments();
        new Notice("Shared documents synced");
      },
    });

    this.addSettingTab(new PushsidianSettingTab(this.app, this));

    // File watchers
    if (this.settings.syncEnabled) {
      this.registerEvent(
        this.app.vault.on("create", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            this.fileWatcher.onFileChange(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof TFile && file.extension === "md") {
            this.fileWatcher.onFileChange(file);
          }
        })
      );
    }

    // Initial sync of shared docs
    this.downloader.syncSharedDocuments();
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TEAM)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE_TEAM, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }

  onunload() {}

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    this.fileWatcher?.loadCache(data?.syncCache ?? {});
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      syncCache: this.fileWatcher?.saveCache() ?? {},
    });
  }
}

class PushsidianSettingTab extends Plugin {
  plugin: PushsidianPlugin;

  constructor(app: App, plugin: PushsidianPlugin) {
    super(app, plugin.manifest);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Pushsidian Settings" });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your Pushsidian API key from the web app")
      .addText((text) =>
        text
          .setPlaceholder("psk_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Base URL")
      .setDesc("Override the API endpoint")
      .addText((text) =>
        text
          .setPlaceholder("https://api.pushsidian.com")
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiBaseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Organization ID")
      .setDesc("Your team organization ID")
      .addText((text) =>
        text
          .setPlaceholder("org_...")
          .setValue(this.plugin.settings.orgId)
          .onChange(async (value) => {
            this.plugin.settings.orgId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable sync")
      .setDesc("Automatically sync shared notes")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncEnabled).onChange(async (value) => {
          this.plugin.settings.syncEnabled = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
