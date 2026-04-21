# VAST DataEngine Plugin

Cursor skills and rules for building VAST DataEngine serverless applications using the `vastde` CLI.

## Skills

| Skill | Description |
|-------|-------------|
| [create-function](skills/create-function/SKILL.md) | Scaffold a new DataEngine function with the proper `init`/`handler` pattern, project structure, and observability |
| [local-run-and-invoke](skills/local-run-and-invoke/SKILL.md) | Build, run locally, and send test CloudEvents to DataEngine functions |
| [function-manifest](skills/function-manifest/SKILL.md) | Register or update function images in DataEngine via CLI flags or YAML manifests |
| [trigger-manifest](skills/trigger-manifest/SKILL.md) | Create S3 element triggers and schedule triggers that invoke functions |
| [pipeline-manifest](skills/pipeline-manifest/SKILL.md) | Wire triggers, functions, and secrets into a deployable pipeline YAML manifest |
| [pipeline-deploy-and-observe](skills/pipeline-deploy-and-observe/SKILL.md) | Deploy pipelines, check status, view logs, traces, and metrics |

## Rules

| Rule | Description |
|------|-------------|
| [dataengine-function-standards](rules/dataengine-function-standards.mdc) | Coding standards for DataEngine handler files |
| [dataengine-manifest-standards](rules/dataengine-manifest-standards.mdc) | Standards for pipeline, trigger, and secret YAML manifests |

## Typical workflow

```
1. vastde functions init python-pip my-function    # Scaffold
2. (implement init + handler)                      # Code
3. vastde functions build my-function              # Build image
4. vastde functions localrun my-function           # Test locally
5. docker push registry/my-function:v1             # Push image
6. vastde functions create --name my-function ...  # Register
7. vastde triggers create --name my-trigger ...    # Create trigger
8. vastde pipelines create --config @pipeline.yaml # Deploy pipeline
```
