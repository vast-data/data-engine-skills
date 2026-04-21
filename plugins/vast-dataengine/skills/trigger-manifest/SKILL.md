---
name: trigger-manifest
description: Create VAST DataEngine trigger manifests for S3 element triggers and schedule (cron) triggers using the vastde CLI. Use when setting up event sources that invoke DataEngine functions.
---

# VAST DataEngine Trigger Manifest

## When to use

- Creating an S3 bucket trigger that fires on object create/delete
- Creating a scheduled (cron) trigger for periodic function invocation
- Writing a trigger YAML manifest for repeatable deployment
- Wiring triggers into a pipeline

## Trigger types

| Type | Description | Key flags |
|------|-------------|-----------|
| **Element** | Fires on S3 bucket events (object created, deleted, tagged) | `--source-bucket`, `--events` |
| **Schedule** | Fires on a cron schedule | `--cron-schedule` |

## Element trigger (S3 bucket events)

The most common trigger type. Fires when objects are created or deleted in an S3 bucket.

### CLI command

```bash
vastde triggers create \
  --name <trigger-name> \
  --type Element \
  --source-bucket <bucket-name> \
  --events "ObjectCreated:*" \
  --broker-name <broker-name> \
  --broker-type Internal \
  --topic <topic-name>
```

### Required flags

| Flag | Description | Example |
|------|-------------|---------|
| `--name` | Unique trigger name (kebab-case) | `video-upload-trigger` |
| `--type` | Trigger type | `Element` |
| `--source-bucket` | S3 bucket to watch | `video-chunks` |
| `--events` | Event types to match (repeatable) | `ObjectCreated:*` |

### Optional flags

| Flag | Description | Example |
|------|-------------|---------|
| `--broker-name` | Event broker name (or bucket/view name for internal) | `event-broker` |
| `--broker-type` | `Internal` (VAST) or `External` (external Kafka) | `Internal` |
| `--broker-url` | URL for external brokers | `kafka://broker:9092` |
| `--topic` | Target topic for events | `my-topic` |
| `--name-prefix` | Object key prefix filter | `uploads/` |
| `--name-suffix` | Object key suffix filter | `.mp4` |
| `--tag-prefix` | Object tag prefix filter | `priority-` |
| `--tag-suffix` | Object tag suffix filter | `-high` |
| `--description` | Human-readable description | |
| `--tags` | Custom labels | `env:prod,team:data` |
| `--custom-extension` | Custom CloudEvent extension as `key=value` | `region=us-east` |

### Supported S3 events

| Event | Description |
|-------|-------------|
| `ObjectCreated:*` | Any object creation (put, copy, multipart) |
| `ObjectRemoved:*` | Any object deletion |
| `ObjectTagging:Put` | Tag added to object |
| `ObjectTagging:Delete` | Tag removed from object |

## Schedule trigger (cron)

Fires on a time-based schedule using cron syntax.

### CLI command

```bash
vastde triggers create \
  --name <trigger-name> \
  --type Schedule \
  --cron-schedule "0 */6 * * *" \
  --broker-name <broker-name> \
  --broker-type Internal \
  --topic <topic-name>
```

### Cron schedule examples

| Schedule | Meaning |
|----------|---------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 1 * *` | First day of month |

## Trigger manifest YAML file

You can define trigger properties in a YAML file and pass it with `--from-file`:

```bash
vastde triggers create --from-file trigger.yaml
```

### Element trigger template (`trigger.yaml`)

```yaml
name: video-upload-trigger
type: Element
source_bucket: video-chunks
events:
  - "ObjectCreated:*"
broker_name: event-broker
broker_type: Internal
topic: video-events
name_suffix: ".mp4"
description: "Fires when a new video is uploaded to the video-chunks bucket"
tags:
  environment: production
  pipeline: video-processing
```

### Schedule trigger template (`schedule-trigger.yaml`)

```yaml
name: daily-cleanup-trigger
type: Schedule
cron_schedule: "0 2 * * *"
broker_name: event-broker
broker_type: Internal
topic: maintenance-events
description: "Daily cleanup trigger at 2 AM"
```

## Listing and inspecting triggers

```bash
# List all triggers
vastde triggers list

# Get details of a specific trigger
vastde triggers get <trigger-name>

# Output as YAML
vastde triggers get <trigger-name> -o yaml
```

## VRN format

After creation, each trigger gets a VAST Resource Name used in pipeline manifests:

```
vast:dataengine:triggers:<trigger-name>
```

Example: `vast:dataengine:triggers:video-upload-trigger`

## Using triggers in pipelines

Triggers are referenced in pipeline manifests inside the `triggers` and `links` sections:

```yaml
# In the pipeline manifest
triggers:
  - name: video-upload-trigger-1          # Instance name in this pipeline
    vrn: vast:dataengine:triggers:video-upload-trigger  # Reference to the trigger

links:
  - source:
      - video-upload-trigger-1            # Trigger instance name
    destination:
      - video-processor-2                 # Function deployment instance name
    topic: vast:dataengine:topics:event-broker/video-events
    config:
      events_order: unordered
      retries: 3
```

## Multiple triggers example

A pipeline can have multiple triggers watching different buckets:

```bash
# Trigger for raw video uploads
vastde triggers create \
  --name video-chunk-land-trigger \
  --type Element \
  --source-bucket video-chunks \
  --events "ObjectCreated:*" \
  --broker-name event-broker \
  --broker-type Internal \
  --topic video-topic

# Trigger for processed segments
vastde triggers create \
  --name video-segment-land-trigger \
  --type Element \
  --source-bucket video-chunks-segments \
  --events "ObjectCreated:*" \
  --broker-name event-broker \
  --broker-type Internal \
  --topic video-topic
```

## Instructions for the agent

1. Ask the user what **event** should fire the trigger (S3 object creation, schedule, etc.).
2. For element triggers, ask for the **source bucket** and any **prefix/suffix filters**.
3. For schedule triggers, ask for the **cron expression**.
4. Ask about broker configuration — use `Internal` for VAST event broker, `External` for Kafka.
5. Generate the `vastde triggers create` command or a YAML manifest file.
6. Use `--dry-run` first if the user wants to validate without creating.
7. Remind the user that triggers must be created **before** referencing them in a pipeline manifest.
