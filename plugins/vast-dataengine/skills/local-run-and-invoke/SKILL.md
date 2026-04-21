---
name: local-run-and-invoke
description: Build, run, and test VAST DataEngine functions locally using vastde CLI. Use when you need to build a function image, run it as a local container, or send test CloudEvents for development and debugging.
---

# Local Run and Invoke

## When to use

- Building a function container image before deployment
- Running a function locally for development and testing
- Sending test events (generated or custom) to a locally running function
- Debugging function behavior before deploying to DataEngine

## Prerequisites

- `vastde` CLI installed and configured
- Docker installed and running
- A builder image set (`vastde builders list` / `vastde builders set`)
- Function source code with `init(ctx)` and `handler(ctx, event)` in the handler file

## Build

Package function source code into a container image:

```bash
vastde functions build <function-name> \
  --target . \
  --image-tag <registry>/<image>:<tag>
```

| Flag | Description | Default |
|------|-------------|---------|
| `--target` | Path to the function source directory | Current directory |
| `--image-tag` | Full image tag including registry | (required) |
| `--version` | Python version (`3.12.*`, `3.11.*`) | Auto-detected |
| `--handlers` | Handler file name | `main.py` |
| `--push` | Push image to registry after build | false |
| `--clear-cache` | Clear build cache | false |
| `--pull-policy` | Builder image pull policy (`never`, `always`, `ifnotpresent`) | `ifnotpresent` |

The build process auto-detects Python from `requirements.txt`, validates that the handler file contains `init(ctx)` and `handler(ctx, event)`, packages dependencies, and produces a container image. A `build.log` file is created in the target directory with detailed output.

### Build examples

```bash
# Build from current directory
vastde functions build my-function --image-tag myregistry/my-function:v1

# Build from a specific directory
vastde functions build my-function \
  --target ./source-code/ingest/my-function \
  --image-tag myregistry/my-function:v1

# Build with a specific Python version
vastde functions build my-function \
  --image-tag myregistry/my-function:v1 \
  --version 3.12.*

# Build and push in one step
vastde functions build my-function \
  --image-tag myregistry/my-function:v1 \
  --push

# Clear cache if you encounter build issues
vastde functions build my-function \
  --image-tag myregistry/my-function:v1 \
  --clear-cache
```

## Local run

Run the built function as a local Docker container:

```bash
vastde functions localrun <function-name> \
  --image-tag <registry>/<image>:<tag> \
  --config config.yaml \
  --port 8080 \
  --loglevel DEBUG
```

| Flag | Description | Default |
|------|-------------|---------|
| `--image-tag` | Image tag to run | `latest` |
| `--config` | Path to `config.yaml` with env vars and secrets | (none) |
| `--port` | Local port to bind | `8080` |
| `--loglevel` | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` | `INFO` |
| `--detach` | Run container in background | false (foreground) |

In **foreground mode**, logs stream in real-time. Press `Ctrl+C` to stop.
In **detached mode** (`--detach`), the container runs in the background.

### Local run examples

```bash
# Run with default settings
vastde functions localrun my-function

# Run with config and debug logging
vastde functions localrun my-function \
  --image-tag myregistry/my-function:dev \
  --config config.yaml \
  --loglevel DEBUG

# Run on a different port
vastde functions localrun my-function \
  --image-tag myregistry/my-function:dev \
  --port 9090

# Run in background
vastde functions localrun my-function \
  --image-tag myregistry/my-function:dev \
  --config config.yaml \
  --detach
```

### Local test config (`config.yaml`)

The `config.yaml` file provides environment variables and secrets to the locally running function. Secrets are mounted in `/secrets` inside the container and exposed via `ctx.secrets` — the same API as in production.

```yaml
envs:
  LOG_LEVEL: DEBUG
  MY_ENV_VAR: some-value

secrets:
  my-pipeline-secret:
    s3_endpoint: "http://<IP_ADDRESS>:9000"
    s3_access_key: ""
    s3_secret_key: ""
    output_bucket: "test-output"
    timeout: "30"
```

The secret name (`my-pipeline-secret`) must match what your `init(ctx)` reads from `ctx.secrets`. For example, if your code does `ctx.secrets["my-pipeline-secret"]["s3_endpoint"]`, the config above provides that value.

### Config for multiple secrets

If your function reads from more than one secret:

```yaml
envs:
  LOG_LEVEL: INFO

secrets:
  db-secret:
    endpoint: "http://<IP_ADDRESS>:5432"
    username: "admin"
    password: "admin"
  s3-secret:
    endpoint: "http://<IP_ADDRESS>:9000"
    access_key: ""
    secret_key: ""
```

## Invoke (send test events)

With the function running locally, send CloudEvents to test it.

### Generate a default test event

```bash
vastde functions invoke \
  --generate-event \
  --url http://<IP_ADDRESS>:8080/
```

Creates a standard VAST DataEngine CloudEvent and sends it. Useful for a quick smoke test.

### Send a custom event from a YAML file

```bash
vastde functions invoke \
  --event my-event.yaml \
  --url http://<IP_ADDRESS>:8080/
```

### Specify the event type

```bash
vastde functions invoke \
  --generate-event \
  --event-type "vastdata.com:Element.ObjectCreated" \
  --url http://<IP_ADDRESS>:8080/
```

### Invoke flags

| Flag | Description | Default |
|------|-------------|---------|
| `--generate-event` | Generate a default CloudEvent automatically | false |
| `--event` | Path to a CloudEvent YAML file | (none) |
| `--event-type` | Type for generated CloudEvent | DataEngine default |
| `--url` | URL of the locally running function | `http://<IP_ADDRESS>:8080/` |

## Custom event file format

The event file follows the [CloudEvents](https://cloudevents.io/) specification.

### S3 trigger event (element trigger)

Use this when testing a function that is triggered by S3 bucket object creation:

```yaml
id: "test-event-001"
source: "vastdata.com/test"
type: "vastdata.com:Element.ObjectCreated"
subject: "my-bucket/my-object.mp4"
data:
  Records:
    - eventName: "ObjectCreated:Put"
      s3:
        bucket:
          name: "my-bucket"
        object:
          key: "uploads/video.mp4"
          size: 10485760
          eTag: "abc123"
          sequencer: "001"
```

### Function-to-function event

Use this when testing a downstream function that receives output from an upstream function (not an S3 trigger). Shape the `data` to match what the upstream function returns:

```yaml
id: "test-downstream-001"
source: "vastdata.com/test"
type: "vastdata.com:Function.Output"
data:
  status: "success"
  source: "s3://my-bucket/video.mp4"
  filename: "video.mp4"
  reasoning_content: "A person walking across a street."
  embedding:
    - 0.123
    - 0.456
    - 0.789
```

### Schedule trigger event

Use this when testing a function invoked by a cron schedule trigger:

```yaml
id: "test-schedule-001"
source: "vastdata.com/test"
type: "vastdata.com:Schedule.Tick"
data:
  trigger_name: "daily-cleanup-trigger"
  scheduled_time: "2026-03-24T02:00:00Z"
```

### Minimal event (quick test)

```yaml
id: "test-minimal"
source: "vastdata.com/test"
type: "vastdata.com:Test"
data:
  message: "hello"
```

## What to look for after invoke

The invoke command displays:
- **HTTP status code** — `200` means the function executed successfully
- **Response body** — the dict returned by your `handler` function

Check the `localrun` terminal for:
- Real-time structured logs from `ctx.logger`
- OpenTelemetry tracing spans
- Error stack traces if the function fails

## Full local development workflow

```bash
# 1. Build the function image
vastde functions build my-function \
  --target ./my-function \
  --image-tag myregistry/my-function:dev

# 2. Start the function locally (foreground — logs stream here)
vastde functions localrun my-function \
  --image-tag myregistry/my-function:dev \
  --config config.yaml \
  --loglevel DEBUG

# 3. In another terminal, send a generated test event
vastde functions invoke \
  --generate-event \
  --url http://<IP_ADDRESS>:8080/

# 4. Or send a custom S3 event
vastde functions invoke \
  --event test-s3-event.yaml \
  --url http://<IP_ADDRESS>:8080/

# 5. Iterate: edit code → rebuild → localrun → invoke
# The build caches runtime and dependencies for faster rebuilds.
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on handler validation | Ensure `main.py` exports both `init(ctx)` and `handler(ctx, event)` |
| Build fails on dependencies | Check `requirements.txt` for version conflicts; try `--clear-cache` |
| Container starts but function errors on init | Check `config.yaml` secret names match what `init(ctx)` expects |
| Invoke returns 500 | Check `localrun` terminal for the Python traceback |
| Port already in use | Use `--port <other-port>` and update the `--url` in invoke |
| Stale image after code change | Rebuild with `vastde functions build` before `localrun` |

## Instructions for the agent

1. Ensure the function source code exists with `init(ctx)` and `handler(ctx, event)`.
2. Build the image with `vastde functions build`.
3. Create a `config.yaml` with secrets matching the function's `ctx.secrets` usage.
4. Start `vastde functions localrun` in foreground mode with `--loglevel DEBUG`.
5. Create a test event YAML matching the expected input format (S3 event, upstream function output, or schedule).
6. Run `vastde functions invoke` with the event file or `--generate-event`.
7. Check the HTTP response and the `localrun` logs for errors.
8. If the function needs changes, edit code, rebuild, and re-run.
