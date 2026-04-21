# VAST DataEngine Skills

Cursor Marketplace plugin with skills and rules for building and deploying VAST DataEngine serverless applications.

## Plugins

| Plugin | Description |
|--------|-------------|
| [vast-dataengine](plugins/vast-dataengine/) | Skills for creating DataEngine functions, triggers, and pipelines using the `vastde` CLI |

## Getting started

1. Install the plugin in Cursor from the Marketplace.
2. Use the skills to scaffold functions, write manifests, and deploy pipelines.

## Skills overview

- **create-function** — Scaffold a new DataEngine function with the `init`/`handler` pattern, project structure, settings model, and observability
- **local-run-and-invoke** — Build, run locally, and send test CloudEvents to functions for development and debugging
- **function-manifest** — Register or update function container images via `vastde functions create` or YAML manifests
- **trigger-manifest** — Create S3 element or schedule triggers that invoke functions
- **pipeline-manifest** — Wire triggers, functions, and secrets into a deployable pipeline YAML
- **pipeline-deploy-and-observe** — Deploy pipelines, check status, and view logs, traces, and metrics

## Structure

```
.cursor-plugin/
  marketplace.json              # Marketplace manifest
plugins/
  vast-dataengine/
    .cursor-plugin/
      plugin.json               # Plugin manifest
    skills/
      create-function/SKILL.md       # Function scaffolding skill
      local-run-and-invoke/SKILL.md  # Build, run, and test locally
      function-manifest/SKILL.md
      trigger-manifest/SKILL.md
      pipeline-manifest/SKILL.md
      pipeline-deploy-and-observe/SKILL.md
    rules/
      dataengine-function-standards.mdc
      dataengine-manifest-standards.mdc
    assets/
      logo.jpg
    README.md
docs/
  add-a-plugin.md               # Guide for adding more plugins
scripts/
  validate-template.mjs         # Validation script
```

## Validation

```bash
node scripts/validate-template.mjs
```

## Adding more plugins

See [docs/add-a-plugin.md](docs/add-a-plugin.md).

