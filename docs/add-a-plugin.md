# Add a plugin

Add a new plugin under `plugins/` and register it in `.cursor-plugin/marketplace.json`.

## 1. Create plugin directory

Create a new folder:

    plugins/my-new-plugin/

Add the required manifest:

    plugins/my-new-plugin/.cursor-plugin/plugin.json

Example manifest:

```json
{
  "name": "my-new-plugin",
  "displayName": "My New Plugin",
  "version": "0.1.0",
  "description": "Describe what this plugin does",
  "author": { "name": "VAST Data" },
  "logo": "assets/logo.jpg"
}
```

## 2. Add plugin components

Add only the components you need:

- `rules/` with `.mdc` files (YAML frontmatter required: `description`)
- `skills/<name>/SKILL.md` (YAML frontmatter required: `name`, `description`)
- `agents/*.md` (YAML frontmatter required: `name`, `description`)
- `commands/*.(md|mdc|markdown|txt)` (frontmatter recommended)
- `hooks/hooks.json` and `scripts/*` for automation hooks
- `mcp.json` for MCP server definitions
- `assets/logo.jpg` for marketplace display

## 3. Register in marketplace manifest

Edit `.cursor-plugin/marketplace.json` and append a new entry:

```json
{
  "name": "my-new-plugin",
  "source": "./plugins/my-new-plugin",
  "description": "Describe your plugin"
}
```

## 4. Validate

```bash
node scripts/validate-template.mjs
```

## 5. Common pitfalls

- Plugin name not kebab-case
- Source path mismatch
- Missing `.cursor-plugin/plugin.json`
- Missing frontmatter keys (`name`, `description`) in skills, agents, commands
- Rule files missing frontmatter `description`
- Using a filename other than `mcp.json` for MCP
- Broken relative paths for logo, hooks, or mcpServers
