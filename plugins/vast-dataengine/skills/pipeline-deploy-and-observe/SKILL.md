---
name: pipeline-deploy-and-observe
description: Deploy a VAST DataEngine pipeline, check its status, view logs, traces, and metrics. Use when deploying a pipeline to Kubernetes, monitoring execution, or debugging function failures.
---

# Pipeline Deploy and Observe

## When to use

- Deploying a pipeline to Kubernetes after creation or update
- Checking the status and configuration of a running pipeline
- Viewing function logs to debug errors or monitor execution
- Inspecting distributed traces across pipeline functions
- Querying metrics for performance analysis

## Deploy a pipeline

### Create and deploy in one step

```bash
vastde pipelines create \
  --name my-pipeline \
  --config @pipeline.yaml \
  --secret-file secret.yaml \
  --deploy
```

The `--deploy` flag activates the pipeline immediately after creation.

### Deploy an existing pipeline

If a pipeline was created without `--deploy`, or after an update:

```bash
vastde pipelines deploy my-pipeline
```

You can reference the pipeline by name or GUID.

### Update and redeploy

```bash
# Update the pipeline configuration
vastde pipelines update my-pipeline \
  --config @updated-pipeline.yaml \
  --secret-file updated-secret.yaml

# Then deploy the new revision
vastde pipelines deploy my-pipeline
```

## Check pipeline status

### List all pipelines

```bash
vastde pipelines list
```

### Get pipeline details

```bash
# Human-readable summary
vastde pipelines get my-pipeline

# Full details as YAML
vastde pipelines get my-pipeline -o yaml

# Full details as JSON
vastde pipelines get my-pipeline -o json
```

### Get the pipeline manifest

View the full manifest including function deployments, links, triggers, and config:

```bash
# Latest revision manifest
vastde pipelines get my-pipeline --manifest

# Currently deployed revision manifest
vastde pipelines get my-pipeline --deployed

# As YAML for easy reading
vastde pipelines get my-pipeline --manifest -o yaml
```

The `--deployed` flag shows the manifest that is actually running, which may differ from the latest revision if you updated but haven't redeployed yet.

## Logs

Logs capture stdout, stderr, and system events from your pipeline functions.

### Get historical logs

```bash
vastde logs get my-pipeline
```

By default this returns logs from the last 5 minutes, limited to 100 entries.

### Common log queries

```bash
# Logs from the last 30 minutes
vastde logs get my-pipeline --since 30m

# Logs from a specific time range
vastde logs get my-pipeline \
  --since "2026-03-24T10:00:00Z" \
  --end "2026-03-24T11:00:00Z"

# Only errors
vastde logs get my-pipeline --severity ERROR

# Only errors and warnings
vastde logs get my-pipeline --severity WARN

# Logs from a specific function
vastde logs get my-pipeline --function video-segmenter

# Only user-level logs (your ctx.logger output, not runtime internals)
vastde logs get my-pipeline --scope user

# Only runtime/system logs
vastde logs get my-pipeline --scope runtime

# More results, newest first
vastde logs get my-pipeline --limit 500 --order-by desc

# Combine filters
vastde logs get my-pipeline \
  --function video-reasoner \
  --severity ERROR \
  --since 1h \
  --limit 200
```

### Log flags reference

| Flag | Description | Default |
|------|-------------|---------|
| `--since` | Start time — relative (`5m`, `2h`, `1d`) or absolute ISO timestamp | `5m` |
| `--end` | End time — relative or absolute | now |
| `--function` | Filter by function name or GUID | all functions |
| `--severity` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL` | all levels |
| `--scope` | `user` (your code) or `runtime` (platform) | both |
| `--limit` | Max number of log entries | `100` |
| `--order-by` | `asc` or `desc` | `asc` |
| `--trace-id` | Filter by a specific distributed trace ID | (none) |
| `--span-id` | Filter by a specific span ID | (none) |
| `-o` | Output format: `human`, `json`, `yaml` | `human` |

### Tail live logs

Stream logs in real-time as the pipeline processes events:

```bash
# Tail all logs
vastde logs tail my-pipeline

# Tail a specific function
vastde logs tail my-pipeline --function video-embedder

# Tail only errors
vastde logs tail my-pipeline --severity ERROR

# Custom polling interval (default 5s)
vastde logs tail my-pipeline --interval 2s

# Tail with context from the last 10 minutes
vastde logs tail my-pipeline --since 10m
```

Press `Ctrl+C` to stop tailing.

### Tail flags reference

| Flag | Description | Default |
|------|-------------|---------|
| `--function` | Filter by function name or GUID | all functions |
| `--severity` | `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL` | all levels |
| `--scope` | `user` or `runtime` | both |
| `--interval` | Polling interval | `5s` |
| `--limit` | Max entries per poll | `100` |
| `--since` | How far back to start | (none) |
| `--trace-id` | Filter by trace ID | (none) |
| `--span-id` | Filter by span ID | (none) |

## Traces

Traces show the distributed execution flow across pipeline functions. Each trace contains spans representing individual operations (e.g., "S3 Download", "Event Parsing", "Video Segmentation").

### List traces

```bash
# Recent traces (last hour)
vastde traces list my-pipeline

# Traces from the last 30 minutes
vastde traces list my-pipeline --since 30m

# Only failed traces
vastde traces list my-pipeline --status ERROR

# Only successful traces
vastde traces list my-pipeline --status OK

# Filter by event type
vastde traces list my-pipeline --event-type "vastdata.com:Element.ObjectCreated"

# Filter by event ID
vastde traces list my-pipeline --event-id "evt-abc123"

# Limit results, newest first
vastde traces list my-pipeline --limit 50 --order-by desc

# Specific time window
vastde traces list my-pipeline \
  --since "2026-03-24T10:00:00Z" \
  --end "2026-03-24T11:00:00Z"
```

### Traces list flags reference

| Flag | Description | Default |
|------|-------------|---------|
| `--since` | Start time — relative or absolute | (default window) |
| `--end` | End time — relative or absolute | now |
| `--status` | `UNSET`, `OK`, `ERROR` | all |
| `--event-type` | Filter by CloudEvent type | (none) |
| `--event-id` | Filter by event ID | (none) |
| `--limit` | Max traces to return | (default) |
| `--order-by` | `asc` or `desc` | (default) |
| `-o` | Output format: `human`, `json`, `yaml` | `human` |

### Get trace details

Once you have a trace ID (from `traces list` or from logs `--trace-id`):

```bash
# Human-readable span tree
vastde traces get <trace-id>

# Full detail as YAML
vastde traces get <trace-id> -o yaml

# As JSON for programmatic analysis
vastde traces get <trace-id> -o json
```

The trace detail shows all spans with their timing, attributes, status, and parent-child relationships — allowing you to see exactly how an event flowed through each function.

## Metrics

Metrics provide aggregated performance data for functions and pipelines.

### Discover available metrics

```bash
# List all available metric names
vastde metrics names

# Filter by pipeline
vastde metrics names --pipeline my-pipeline

# Filter by function
vastde metrics names --function video-segmenter

# Search by name substring
vastde metrics names --search "invocations"

# Filter by metric type
vastde metrics names --metric-type Counter
vastde metrics names --metric-type Histogram
```

### Query metrics

```bash
# Get a metric over the last hour (default)
vastde metrics get --metric-names "dataengine.function.invocations"

# Custom time window
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --timeframe 24h

# Absolute time range
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --start-time "2026-03-24T00:00:00Z" \
  --end-time "2026-03-24T12:00:00Z"

# Filter by pipeline
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --pipeline my-pipeline

# Filter by function
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --function video-segmenter

# Group by function to compare
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --pipeline my-pipeline \
  --group-by function_name

# Different aggregations
vastde metrics get --metric-names "dataengine.function.duration" --aggregation avg
vastde metrics get --metric-names "dataengine.function.duration" --aggregation p95
vastde metrics get --metric-names "dataengine.function.duration" --aggregation p99
vastde metrics get --metric-names "dataengine.function.duration" --aggregation max

# Top 3 functions by invocation count
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --group-by function_name \
  --top-k 3

# Multiple metrics at once (comma-separated, up to 10)
vastde metrics get \
  --metric-names "dataengine.function.invocations,dataengine.function.duration,dataengine.function.errors"

# Control data point density
vastde metrics get \
  --metric-names "dataengine.function.invocations" \
  --timeframe 24h \
  --max-points 50
```

### Metrics get flags reference

| Flag | Description | Default |
|------|-------------|---------|
| `--metric-names` | Comma-separated metric names (1-10) | (required) |
| `--timeframe` | Time window (`30s`, `5m`, `1h`, `7d`) | `1h` |
| `--start-time` | Absolute start (ISO 8601) — mutually exclusive with `--timeframe` | (none) |
| `--end-time` | Absolute end (ISO 8601) — mutually exclusive with `--timeframe` | (none) |
| `--pipeline` | Filter by pipeline name | (none) |
| `--function` | Filter by function name | (none) |
| `--aggregation` | `sum`, `avg`, `min`, `max`, `p50`, `p95`, `p99` | `avg` |
| `--group-by` | `function_name` or `pipeline_name` | (none) |
| `--top-k` | Top K groups by value (requires `--group-by`) | (none) |
| `--bottom-k` | Bottom K groups by value (requires `--group-by`) | (none) |
| `--metric-type` | `Counter`, `Histogram`, `Gauge`, `UpDownCounter` | (none) |
| `--max-points` | Data points to return (1-100) | (default) |
| `-o` | Output format: `human`, `json`, `yaml` | `human` |

## Debugging workflow

A typical sequence when something goes wrong in a deployed pipeline:

```bash
# 1. Check pipeline status
vastde pipelines get my-pipeline

# 2. Look for recent errors in logs
vastde logs get my-pipeline --severity ERROR --since 30m

# 3. Narrow down to the failing function
vastde logs get my-pipeline --function video-reasoner --severity ERROR --since 30m

# 4. Find failed traces
vastde traces list my-pipeline --status ERROR --since 30m

# 5. Inspect a specific trace for the full span tree
vastde traces get <trace-id>

# 6. Correlate logs with the trace
vastde logs get my-pipeline --trace-id <trace-id>

# 7. Check function metrics for patterns
vastde metrics get \
  --metric-names "dataengine.function.errors" \
  --pipeline my-pipeline \
  --group-by function_name \
  --timeframe 1h

# 8. Tail live logs while testing a fix
vastde logs tail my-pipeline --function video-reasoner --severity ERROR
```

## Instructions for the agent

1. To deploy, use `vastde pipelines create --deploy` or `vastde pipelines deploy <name>`.
2. To check status, use `vastde pipelines get <name>` and `vastde pipelines get <name> --deployed` to compare latest vs running revision.
3. For debugging, start with `vastde logs get <pipeline> --severity ERROR --since 30m` to find errors.
4. Use `vastde logs tail <pipeline>` to stream live logs during active testing.
5. Use `vastde traces list <pipeline> --status ERROR` to find failed execution traces.
6. Use `vastde traces get <trace-id>` to inspect the full span tree of a specific execution.
7. Use `vastde metrics get` to query aggregated performance data and identify patterns.
8. Always suggest `--function` to narrow down to a specific function when the pipeline has many functions.
9. Use `-o yaml` or `-o json` when the user needs to parse output programmatically.
