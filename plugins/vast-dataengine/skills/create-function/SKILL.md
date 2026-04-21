---
name: create-function
description: Create a new VAST DataEngine serverless function with proper project structure, handler pattern, and dependencies. Use when scaffolding a new function from scratch or converting existing code into a DataEngine function.
---

# Create a VAST DataEngine Function

## When to use

- Starting a new DataEngine function project
- Converting existing code into a DataEngine-compatible function
- Scaffolding a function that will be wired into a pipeline

## Prerequisites

- `vastde` CLI installed and configured (`vastde config`)
- Docker installed and running (for building)
- A builder image set (`vastde builders list` / `vastde builders set`)

## Quick scaffold

Run the CLI scaffolding command to generate a starter project:

```bash
vastde functions init python-pip <function-name> --target <directory>
```

This creates a directory with a handler template, `requirements.txt`, and config files.

## Function contract

Every DataEngine Python function **must** export two functions in its handler file (default `main.py`):

### `init(ctx)`

Called once when the function container starts. Use it to:
- Load secrets and configuration from `ctx.secrets`
- Initialize clients, models, or connections
- Attach shared state to `ctx` for use in `handler`
- Register custom metrics via `ctx.counter()` and `ctx.histogram()`

### `handler(ctx, event: VastEvent)`

Called for every incoming event. Must:
- Extract event data via `event.get_data()` (returns a dict)
- Process the data
- Return a dict (passed as input to the next function in the pipeline)

## Handler file template

```python
from vast_runtime.vast_event import VastEvent  # provided by the DataEngine runtime


def init(ctx):
    """Called once at container startup. Initialize clients and load config."""
    # Load secrets from the pipeline secret attached to this function
    secret = ctx.secrets["<your-secret-name>"]

    # Example: create a client and attach to ctx
    # ctx.my_client = MyClient(
    #     endpoint=secret["endpoint"],
    #     access_key=secret["access_key"],
    # )

    # Optional: register custom metrics
    # ctx.items_counter = ctx.counter(
    #     "my_function.items_processed",
    #     description="Total items processed",
    # )


def handler(ctx, event: VastEvent):
    """Called for each incoming event."""
    data = event.get_data()

    # --- Parse input ---
    # For trigger-sourced events (S3), data follows the S3 notification format:
    #   data["Records"][0]["s3"]["bucket"]["name"]
    #   data["Records"][0]["s3"]["object"]["key"]
    #
    # For function-to-function events, data is the dict returned by the upstream function.

    # --- Business logic ---
    result = process(data)

    # --- Return output ---
    # The returned dict becomes the input event data for the next function in the pipeline.
    return {
        "status": "success",
        "source": data.get("source", ""),
        "output_key": result,
    }


def process(data: dict) -> str:
    """Replace with your business logic."""
    raise NotImplementedError
```

## Project structure

```
my-function/
├── main.py              # Handler file (init + handler)
├── requirements.txt     # Python dependencies (pip)
├── Aptfile              # System packages (optional, one per line)
├── customDeps           # Custom dependency script (optional)
├── common/              # Shared modules (optional)
│   ├── __init__.py
│   ├── models.py        # Pydantic settings / data models
│   ├── clients.py       # API / storage clients
│   └── handler_utils.py # Input parsing and output formatting helpers
└── README.md
```

## Observability built-ins

The `ctx` object provides:

| API | Purpose |
|-----|---------|
| `ctx.logger` | Structured logger (Python `logging`) |
| `ctx.tracer` | OpenTelemetry tracer — use `with ctx.tracer.start_as_current_span("name"):` |
| `ctx.counter(name, description)` | Create an OTel counter metric |
| `ctx.histogram(name, description, unit)` | Create an OTel histogram metric |
| `ctx.secrets` | Dict of pipeline secrets (keyed by secret name) |

## Settings pattern (recommended)

Use Pydantic to validate and type configuration loaded from secrets:

```python
from pydantic import BaseModel
from typing import Dict


class Settings(BaseModel):
    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    timeout: int = 30

    @classmethod
    def from_ctx_secrets(cls, secrets: Dict[str, str]) -> "Settings":
        secret = secrets["<your-secret-name>"]
        field_names = cls.__annotations__.keys()
        config = {field: secret[field] for field in field_names if field in secret}
        return cls(**config)
```

## S3 event parsing helper

Functions triggered by S3 bucket events receive either the standard S3 notification format or a flat dict. Use a helper to normalize both:

```python
def parse_s3_event(data: dict) -> dict:
    """Extract bucket, key, and event metadata from S3 or flat event formats."""
    if "Records" in data:
        record = data["Records"][0]
        s3 = record["s3"]
        return {
            "bucket": s3["bucket"]["name"],
            "key": s3["object"]["key"],
            "event_name": record.get("eventName", ""),
            "sequencer": s3["object"].get("sequencer", ""),
            "etag": s3["object"].get("eTag", ""),
        }
    return {
        "bucket": data["bucket"],
        "key": data["key"],
        "event_name": data.get("eventName", ""),
    }
```

## Build, test, and deploy

```bash
# 1. Build the container image
vastde functions build <function-name> \
  --target . \
  --image-tag <registry>/<image>:<tag>

# 2. Test locally
vastde functions localrun <function-name> \
  --image-tag <registry>/<image>:<tag> \
  --config config.yaml

# 3. Push image to registry
docker push <registry>/<image>:<tag>

# 4. Register the function in DataEngine
vastde functions create \
  --name <function-name> \
  --container-registry <registry-name> \
  --artifact-source <image> \
  --artifact-type image \
  --image-tag <tag> \
  --publish
```


For the full local development workflow — building, running locally, creating test events, and debugging — see the **local-run-and-invoke** skill.

## Instructions for the agent

1. Ask the user for the function's **purpose** and **expected input/output**.
2. Run `vastde functions init python-pip <name>` to scaffold, or create the files manually following the structure above.
3. Implement `init(ctx)` to load secrets and create clients.
4. Implement `handler(ctx, event)` with proper error handling and tracing spans.
5. Add a Pydantic `Settings` model in `common/models.py` for typed configuration.
6. Add `requirements.txt` with pinned dependency versions.
7. If the function processes S3 events, include the S3 event parsing helper.
8. Return a dict from `handler` that contains all fields the downstream function needs.
9. Verify the function builds: `vastde functions build <name> --target .`
