---
name: function-manifest
description: Create and manage VAST DataEngine function manifests for registering, updating, and deploying function images using the vastde CLI. Use when you need to register a built function image with DataEngine or update an existing function.
---

# VAST DataEngine Function Manifest

## When to use

- Registering a new function image in DataEngine
- Updating an existing function to a new image version
- Creating a YAML manifest file for repeatable function creation
- Reviewing required fields before `vastde functions create`

## Function registration via CLI flags

The most common way to register a function:

```bash
vastde functions create \
  --name <function-name> \
  --container-registry <registry-name> \
  --artifact-source <org/image-name> \
  --artifact-type image \
  --image-tag <tag> \
  --description "What this function does" \
  --publish
```

### Required flags

| Flag | Description | Example |
|------|-------------|---------|
| `--name` | Unique function name (kebab-case) | `video-segmenter` |
| `--container-registry` | Registry name as registered in DataEngine | `dockerio` |
| `--artifact-source` | Image path within the registry | `vastdatasolutions/vde-video-segmenter` |
| `--artifact-type` | Always `image` | `image` |
| `--image-tag` | Image version tag | `v1` |

### Optional flags

| Flag | Description |
|------|-------------|
| `--description` | Human-readable description |
| `--tags` | Custom labels (`key:value,key:value`) |
| `--architecture` | Target arch (`amd64`, `arm64`) |
| `--publish` | Immediately make available for use |
| `--revision-alias` | Friendly name for this revision |
| `--revision-description` | Description of what changed in this revision |

## Function manifest YAML file

You can define all function properties in a YAML file and pass it with `--from-file`:

```bash
vastde functions create --from-file function.yaml --publish
```

### Manifest template (`function.yaml`)

```yaml
name: my-function
description: "Describe what this function does"
container_registry: dockerio
artifact_type: image
artifact_source: myorg/my-function
image_tag: v1
architecture: amd64
tags:
  environment: production
  team: data-engineering
revision_alias: initial
revision_description: "Initial release"
```

## Updating a function

To deploy a new image version or change configuration:

```bash
vastde functions update <function-name> \
  --image-tag v2 \
  --revision-description "Bug fix for event parsing" \
  --publish
```

Or from a file:

```bash
vastde functions update <function-name> --from-file function.yaml --publish
```

Updates create a new **revision**. Use `--publish` to make the new revision active. Without `--publish`, the revision is created but not used by pipelines.

## Listing and inspecting functions

```bash
# List all functions
vastde functions list

# Get details for a specific function
vastde functions get <function-name>

# Output as YAML (useful for creating manifests from existing functions)
vastde functions get <function-name> -o yaml
```

## Container registry setup

Before creating functions, ensure your container registry is linked to DataEngine:

```bash
# List available registries
vastde container-registries list

# Link a new registry
vastde container-registries link \
  --name my-registry \
  --url https://registry.example.com \
  --username <user> \
  --password <token>
```

## VRN format

After creation, each function gets a VAST Resource Name used in pipeline manifests:

```
vast:dataengine:functions:<function-name>
```

Example: `vast:dataengine:functions:video-segmenter`

## Build and push workflow

Before registering, the function image must be built and pushed:

```bash
# Build
vastde functions build <function-name> \
  --target /path/to/function \
  --image-tag <registry>/<image>:<tag>

# Push to registry
docker push <registry>/<image>:<tag>

# Register
vastde functions create \
  --name <function-name> \
  --container-registry <registry-name> \
  --artifact-source <image> \
  --artifact-type image \
  --image-tag <tag> \
  --publish
```

## Instructions for the agent

1. Ask the user for the function **name**, **registry**, **image name**, and **tag**.
2. If the user wants a YAML manifest file, generate `function.yaml` using the template above.
3. If the user wants a CLI command, construct `vastde functions create` with the appropriate flags.
4. Always include `--publish` unless the user explicitly wants an unpublished revision.
5. For updates, use `vastde functions update` with the function name or GUID.
6. Remind the user to build and push the image before running `create`.
7. Use `--dry-run` first if the user wants to validate without making changes.
