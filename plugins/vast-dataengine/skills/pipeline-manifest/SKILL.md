---
name: pipeline-manifest
description: Create VAST DataEngine pipeline manifests that wire triggers, functions, and secrets into deployable data processing workflows. Use when building or modifying a pipeline configuration YAML file.
---

# VAST DataEngine Pipeline Manifest

## When to use

- Creating a new pipeline YAML configuration
- Wiring functions and triggers together into a data flow
- Adding secrets, resource limits, or retry policies to a pipeline
- Deploying or updating an existing pipeline

## Pipeline concepts

A **pipeline** is a declarative workflow that defines how data flows through DataEngine:

- **Function deployments**: Instances of registered functions with resource limits and scaling
- **Triggers**: Event sources (S3 bucket events, schedules) that start the pipeline
- **Links**: Connections between triggers and functions, or between functions
- **Secrets**: Configuration data shared across all functions in the pipeline
- **Config**: Environment variables and shared settings

## Create and deploy a pipeline

```bash
vastde pipelines create \
  --name <pipeline-name> \
  --config @pipeline.yaml \
  --secret-file secret.yaml \
  --deploy
```

| Flag | Description |
|------|-------------|
| `--name` | Pipeline name |
| `--config` | Path to pipeline manifest YAML (prefix with `@` for file path) |
| `--secret-file` | Path to secret YAML file (repeatable for multiple secrets) |
| `--deploy` | Deploy immediately after creation |
| `--description` | Human-readable description |
| `--tags` | Custom labels |
| `--dry-run` | Validate without creating |

## Pipeline manifest template (`pipeline.yaml`)

```yaml
kubernetes_cluster_vrn: vast:dataengine:kubernetes-clusters:<cluster-name>
namespace: default
name: <pipeline-name>
manifest:
  config:
    environment_variables: []
    secrets:
      - <secret-name>

  function_deployments:
    - function_vrn: vast:dataengine:functions:<function-1>
      name: <function-1>-1
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 10
        timeout: 120

    - function_vrn: vast:dataengine:functions:<function-2>
      name: <function-2>-2
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 5
        timeout: 120

  links:
    # Trigger → first function (requires topic)
    - source:
        - <trigger-instance-name>
      destination:
        - <function-1>-1
      topic: vast:dataengine:topics:<broker-name>/<topic-name>
      config:
        events_order: unordered
        retries: 3

    # Function → function (no topic needed)
    - source:
        - <function-1>-1
      destination:
        - <function-2>-2
      config:
        events_order: unordered
        retries: 3

  triggers:
    - name: <trigger-instance-name>
      vrn: vast:dataengine:triggers:<trigger-name>
```

## Pipeline manifest fields reference

### Top level

| Field | Required | Description |
|-------|----------|-------------|
| `kubernetes_cluster_vrn` | Yes | VRN of the target K8s cluster. Find it with `vastde compute-clusters list` |
| `namespace` | Yes | Kubernetes namespace for deployment |
| `name` | Yes | Pipeline name |
| `manifest` | Yes | Pipeline definition (see below) |

### `manifest.config`

| Field | Description |
|-------|-------------|
| `environment_variables` | List of env vars available to all functions |
| `secrets` | List of secret names to attach (must match secret file `name` field) |

### `manifest.function_deployments[]`

| Field | Required | Description |
|-------|----------|-------------|
| `function_vrn` | Yes | VRN of the registered function |
| `name` | Yes | Instance name within this pipeline (must be unique) |
| `revision` | Yes | Function revision number to use |
| `config.log_level` | No | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `resources.min_cpu` | No | Minimum CPU (millicores, e.g. `1000m` = 1 core) |
| `resources.max_cpu` | No | Maximum CPU |
| `resources.min_memory` | No | Minimum memory (e.g. `1280Mi`) |
| `resources.max_memory` | No | Maximum memory |
| `resources.min_concurrency` | No | Minimum concurrent instances |
| `resources.max_concurrency` | No | Maximum concurrent instances |
| `resources.timeout` | No | Execution timeout in seconds |

### `manifest.links[]`

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | List of source instance names (trigger or function) |
| `destination` | Yes | List of destination instance names (function) |
| `topic` | Conditional | Required for trigger-to-function links. VRN format: `vast:dataengine:topics:<broker>/<topic>` |
| `config.events_order` | No | `unordered` or `ordered` |
| `config.retries` | No | Number of retry attempts on failure |

### `manifest.triggers[]`

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Instance name within this pipeline (referenced in links) |
| `vrn` | Yes | VRN of the trigger (must already exist) |

## Secret file template (`secret.yaml`)

Secrets are key-value pairs shared across all functions in the pipeline:

```yaml
name: <secret-name>
kubernetes_cluster_vrn: vast:dataengine:kubernetes-clusters:<cluster-name>
namespace: default
entries:
  - key: s3_endpoint
    value: "http://10.0.0.1"
  - key: s3_access_key
    value: "<access-key>"
  - key: s3_secret_key
    value: "<secret-key>"
  - key: output_bucket
    value: "processed-data"
```

### Secret file fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Secret name (must match `manifest.config.secrets[]` entry) |
| `kubernetes_cluster_vrn` | Yes | Same cluster VRN as the pipeline |
| `namespace` | Yes | Same namespace as the pipeline |
| `entries` | Yes | List of key-value pairs |
| `entries[].key` | Yes | Secret key name (accessed in code via `ctx.secrets["<secret-name>"]["<key>"]`) |
| `entries[].value` | Yes | Secret value |

## Naming conventions

Pipeline manifests use **instance names** to identify triggers and functions within a pipeline. These are different from the resource names:

| Concept | Example | Where used |
|---------|---------|------------|
| Function name (global) | `video-segmenter` | `vastde functions create --name` |
| Function VRN | `vast:dataengine:functions:video-segmenter` | `function_deployments[].function_vrn` |
| Function instance name | `video-segmenter-1` | `function_deployments[].name`, `links[].source/destination` |
| Trigger name (global) | `video-upload-trigger` | `vastde triggers create --name` |
| Trigger VRN | `vast:dataengine:triggers:video-upload-trigger` | `triggers[].vrn` |
| Trigger instance name | `video-upload-trigger-1` | `triggers[].name`, `links[].source` |

## Complete example

A 4-function video processing pipeline with 2 S3 triggers:

```yaml
kubernetes_cluster_vrn: vast:dataengine:kubernetes-clusters:k8s
namespace: default
name: video-processing-pipeline
manifest:
  config:
    environment_variables: []
    secrets:
      - video-pipeline-secret

  function_deployments:
    - function_vrn: vast:dataengine:functions:video-segmenter
      name: video-segmenter-1
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 10
        timeout: 120

    - function_vrn: vast:dataengine:functions:video-reasoner
      name: video-reasoner-2
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 5
        timeout: 120

    - function_vrn: vast:dataengine:functions:video-embedder
      name: video-embedder-3
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 5
        timeout: 120

    - function_vrn: vast:dataengine:functions:video-vastdb-writer
      name: video-vastdb-writer-4
      revision: 1
      config:
        log_level: INFO
      resources:
        min_cpu: 1000m
        max_cpu: 5000m
        min_memory: 1280Mi
        max_memory: 2560Mi
        min_concurrency: 1
        max_concurrency: 10
        timeout: 120

  links:
    - source:
        - video-chunk-trigger-1
      destination:
        - video-segmenter-1
      topic: vast:dataengine:topics:event-broker/video-topic
      config:
        events_order: unordered
        retries: 3

    - source:
        - video-segment-trigger-2
      destination:
        - video-reasoner-2
      topic: vast:dataengine:topics:event-broker/video-topic
      config:
        events_order: unordered
        retries: 3

    - source:
        - video-reasoner-2
      destination:
        - video-embedder-3
      config:
        events_order: unordered
        retries: 3

    - source:
        - video-embedder-3
      destination:
        - video-vastdb-writer-4
      config:
        events_order: unordered
        retries: 3

  triggers:
    - name: video-chunk-trigger-1
      vrn: vast:dataengine:triggers:video-chunk-land-trigger
    - name: video-segment-trigger-2
      vrn: vast:dataengine:triggers:video-segment-land-trigger
```

## Managing pipelines

```bash
# List all pipelines
vastde pipelines list

# Get pipeline details
vastde pipelines get <pipeline-name>

# Get pipeline manifest as YAML (useful for editing)
vastde pipelines get <pipeline-name> -o yaml

# Update an existing pipeline
vastde pipelines update <pipeline-name> \
  --config @updated-pipeline.yaml

# Deploy a pipeline that was created without --deploy
vastde pipelines deploy <pipeline-name>

# Delete a pipeline
vastde pipelines delete <pipeline-name>
```

## Setup checklist

Before creating a pipeline, ensure:

1. **DataEngine is set up**: `vastde setup-dataengine` with broker and topic configuration
2. **Compute cluster is linked**: `vastde compute-clusters list` to verify
3. **Container registry is linked**: `vastde container-registries list` to verify
4. **Functions are created**: `vastde functions list` — all referenced functions must exist
5. **Triggers are created**: `vastde triggers list` — all referenced triggers must exist
6. **Secret file is prepared**: All keys required by your functions are present

## Instructions for the agent

1. Ask the user for the **pipeline name** and the **list of functions** in order.
2. Ask about **triggers** — what events start the pipeline (S3 buckets, schedules).
3. Ask for the **Kubernetes cluster VRN** and **namespace** (or suggest running `vastde compute-clusters list`).
4. Generate the pipeline YAML manifest with function deployments, links, and trigger references.
5. Generate the secret YAML file with placeholder values for all keys the functions need.
6. Construct the `vastde pipelines create` command with `--config`, `--secret-file`, and optionally `--deploy`.
7. Validate trigger instance names in `links[].source` match `triggers[].name`.
8. Validate function instance names in `links[].source/destination` match `function_deployments[].name`.
9. Use `--dry-run` first if the user wants to validate the manifest without deploying.
