import { Modal, App, Setting, Notice } from "obsidian";
import type PushsidianPlugin from "../main";

export class SetupModal extends Modal {
  private plugin: PushsidianPlugin;
  private apiKeyInput: HTMLInputElement;
  private saveButton: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(app: App, plugin: PushsidianPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pushsidian-setup-modal");

    contentEl.createEl("h2", { text: "Welcome to Pushsidian" });

    contentEl.createEl("p", {
      text: "Pushsidian lets you share notes with your team and tap into shared knowledge using AI.",
    });

    const steps = contentEl.createEl("ol", { cls: "pushsidian-setup-steps" });
    steps.createEl("li", { text: "Your notes stay in Obsidian — nothing changes locally." });
    steps.createEl("li", { text: "Add share: [team] to any note to share it with your team." });
    steps.createEl("li", { text: "Your team can read shared notes in their vault or on the web." });

    contentEl.createEl("p", {
      text: "To get started, paste your API key below. You can find it in the web app under your profile.",
      cls: "pushsidian-setup-hint",
    });

    new Setting(contentEl)
      .setName("API key")
      .setDesc("Looks like psk_...")
      .addText((text) => {
        text.setPlaceholder("psk_...");
        this.apiKeyInput = text.inputEl;
        this.apiKeyInput.type = "password";
        text.onChange(() => this.updateSaveState());
      });

    this.statusEl = contentEl.createEl("div", { cls: "pushsidian-setup-status" });

    const btnRow = contentEl.createEl("div", { cls: "pushsidian-setup-buttons" });

    this.saveButton = btnRow.createEl("button", {
      text: "Save and connect",
      cls: "mod-cta",
    });
    this.saveButton.disabled = true;
    this.saveButton.addEventListener("click", () => this.save());

    const skip = btnRow.createEl("button", { text: "Skip for now" });
    skip.addEventListener("click", () => this.close());
  }

  private updateSaveState() {
    const val = this.apiKeyInput.value.trim();
    this.saveButton.disabled = val.length < 10;
  }

  private async save() {
    const key = this.apiKeyInput.value.trim();
    if (!key) return;

    this.saveButton.disabled = true;
    this.saveButton.textContent = "Checking...";
    this.statusEl.empty();

    // Temporarily set key to test it
    const oldKey = this.plugin.settings.apiKey;
    this.plugin.settings.apiKey = key;

    try {
      const user = await this.plugin.api.getUser();
      await this.plugin.saveSettings();
      this.statusEl.createEl("span", { text: "Connected! Welcome, " + (user.display_name || "there") + "." });
      setTimeout(() => this.close(), 1200);
    } catch (err: any) {
      this.plugin.settings.apiKey = oldKey;
      this.statusEl.createEl("span", {
        text: "Could not connect. Check your API key and try again.",
        cls: "pushsidian-setup-error",
      });
      this.saveButton.textContent = "Save and connect";
      this.saveButton.disabled = false;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
