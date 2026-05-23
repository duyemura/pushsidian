import { Modal, Setting, TFile, Notice, TextComponent } from "obsidian";
import type PushsidianPlugin from "../main";

interface Member {
  id: string;
  display_name: string;
}

export class ShareModal extends Modal {
  private members: Member[] = [];
  private filtered: Member[] = [];
  private currentShare: string[] = []; // stores display names
  private shareWithEveryone = false;
  private searchInput: TextComponent | null = null;

  constructor(
    app: any,
    private plugin: PushsidianPlugin,
    private file: TFile,
    private pendingMentions: string[] = []
  ) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Share note" });

    // Read current frontmatter (store human names, not IDs)
    const cache = this.plugin.app.metadataCache.getFileCache(this.file);
    const share = cache?.frontmatter?.share;
    if (share === true) {
      this.shareWithEveryone = true;
      this.currentShare = [];
    } else if (Array.isArray(share)) {
      this.currentShare = share.filter((s: unknown) => typeof s === "string");
    } else if (typeof share === "string") {
      this.currentShare = [share];
    }

    // Fetch org members
    try {
      this.members = (await this.plugin.api.getOrgMembers(this.plugin.settings.orgId))
        .filter((m: Member) => m.display_name?.trim().length > 0);
      this.filtered = this.members;
    } catch (err) {
      contentEl.createEl("p", {
        text: "Failed to load team members. Check your API settings.",
        cls: "text-error",
      });
      return;
    }

    // Migrate any raw IDs in currentShare to display names
    this.currentShare = this.currentShare.map((s) => {
      const member = this.members.find((m) => m.id === s || m.display_name.toLowerCase() === s.toLowerCase());
      return member ? member.display_name : s;
    });

    // Auto-toggle on any pending @mentions so they start checked
    const pendingNames = this.members
      .filter((m) => this.pendingMentions.includes(m.id))
      .map((m) => m.display_name)
      .filter((name) => !this.currentShare.some((s) => s.toLowerCase() === name.toLowerCase()));
    for (const name of pendingNames) {
      this.currentShare.push(name);
    }

    // Everyone toggle
    new Setting(contentEl)
      .setName("Share with everyone in org")
      .setDesc("Anyone in your organization can see this note.")
      .addToggle((toggle) =>
        toggle.setValue(this.shareWithEveryone).onChange((val) => {
          this.shareWithEveryone = val;
          this.renderMemberList();
        })
      );

    // Search
    const searchSetting = new Setting(contentEl)
      .setName("Find people")
      .setClass("pushsidian-search");
    searchSetting.addSearch((search) => {
      this.searchInput = search as unknown as TextComponent;
      search.setPlaceholder("Type @name to filter...");
      search.onChange((val) => {
        const q = val.toLowerCase().replace(/^@/, "");
        this.filtered = q
          ? this.members.filter((m) => m.display_name.toLowerCase().includes(q))
          : this.members;
        this.renderMemberList();
      });
    });

    // Member list container
    const listEl = contentEl.createDiv({ cls: "pushsidian-member-list" });
    listEl.id = "pushsidian-member-list";
    listEl.style.paddingBottom = "8px";

    this.renderMemberList();

    // Actions — Save + Cancel on one row
    const actionRow = new Setting(contentEl);
    actionRow.addButton((btn) =>
      btn
        .setButtonText("Save")
        .setCta()
        .onClick(() => this.save())
    );
    actionRow.addButton((btn) =>
      btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }

  private renderMemberList() {
    const listEl = this.contentEl.querySelector("#pushsidian-member-list") as HTMLElement;
    if (!listEl) return;
    listEl.empty();

    if (this.shareWithEveryone) {
      listEl.createEl("p", { text: "Sharing with everyone — specific people hidden.", cls: "text-sm text-gray-400 italic" });
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
      const row = new Setting(listEl)
        .setName(member.display_name)
        .addToggle((toggle) =>
          toggle.setValue(isChecked).onChange((val) => {
            if (val) {
              this.currentShare.push(member.display_name);
            } else {
              this.currentShare = this.currentShare.filter(
                (s) => s.toLowerCase() !== member.display_name.toLowerCase()
              );
            }
          })
        );
      // Tighten spacing: remove extra bottom margin on last row
      row.settingEl.style.marginBottom = "0";
    }
  }

  async save() {
    // Grace period: prevent mention detection from reopening the modal
    // while processFrontMatter triggers a file-change event
    (this.plugin as any).__shareSaveGrace = Date.now();
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

    new Notice("Sharing rules updated — note will sync shortly");
    // Clear pending mentions now that they've been committed
    delete (this.plugin as any).__pendingMentions;
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    (this.plugin as any).__shareModalOpen = false;
  }
}
