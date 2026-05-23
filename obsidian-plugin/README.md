# Pushsidian Plugin

Share notes with your team and let AI tap into your collective knowledge.

## Installation

### Option 1: Download release (recommended)

1. Download `pushsidian-plugin.zip` from the [latest release](../../releases)
2. Unzip it into your vault's `.obsidian/plugins/pushsidian/` folder
3. In Obsidian: **Settings → Community plugins → Pushsidian** → toggle ON

### Option 2: Clone and symlink (developers)

```bash
# In your vault's .obsidian/plugins directory
cd ~/.obsidian/plugins
ln -s /path/to/pushsidian/obsidian-plugin pushsidian
```

## Configuration

1. Open **Settings → Pushsidian**
2. Paste your API key from the web app (`psk_...`)
3. Set API URL (default: `http://localhost:8080` for local dev)
4. Set your Organization ID

## Sharing a note

Add frontmatter to any markdown file:

```yaml
---
share: [everyone]
---
```

Save the file — it syncs automatically.

## Syncing shared docs

`Cmd+P` → **"Pushsidian: Sync shared documents now"**

Shared docs appear under `OrgName/PersonName/` in your vault.
