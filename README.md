# Orbit Studio

A self-hosted tool for building computer use workflows. You draw a graph of steps, describe what you want each step to do, and an AI agent executes them on a real desktop inside Docker — browser, terminal, or any GUI app.

Works best with the browser. Chrome login sessions persist across restarts via a named Docker volume, so the agent stays logged into sites between runs.


## What you can do with it

- Scrape structured data from websites into JSON or CSV
- Fill and submit forms using credentials from a secrets vault
- Monitor pages on a schedule and branch based on what's on screen
- Process a CSV row by row, one browser action per row
- Chain scraping, analysis, and file output into a single workflow

## How it works

Workflows are graphs. Each node is a step: navigate to a URL, do something, read data, check a condition, run Python. The agent runs each step in order inside a Docker VM with a full browser. You can watch it over VNC, pause and take manual control, then hand back.

Runs can be triggered from the UI, via webhook, or on a cron schedule.


## Quick start

```bash
git clone https://github.com/aadya940/orbit-ui
cd orbit-ui

cp .env.example .env
# Set GEMINI_API_KEY (or any supported LLM key)

docker compose up
```

Open **http://127.0.0.1:3000**

> **Windows:** use `127.0.0.1` not `localhost` — on Windows, `localhost` resolves to IPv6 and the connection will fail.


## Nodes

| Node | What it does |
|------|-------------|
| `Navigate` | Go to a URL |
| `Do` | Describe an action in plain English |
| `Read` | Extract data from the current page. Add an output schema to get typed fields. |
| `Fill` | Fill a form. Map field names to values, use `{{secrets.KEY}}` for credentials. |
| `Check` | Yes/no question about the screen. Routes to a true or false branch. |
| `ForEach` | Loop over a list |
| `Code` | Run Python inline. Has access to all previous node outputs. |
| `Agent` | Custom node type. Bring your own class and prompt. |
| `Bootstrap` | Run `apt-get install` before the workflow starts. No LLM involved. |


## Features

**Output schemas** — tell a Read or Do node what fields to return and what types they should be. Downstream nodes can reference them as `{{node_id.field}}`.

**Workflow inputs** — declare parameters and pass them in at run time via the UI, webhook body, or cron config. Reference as `{{inputs.name}}`.

**Webhooks** — every workflow has a POST endpoint:
```bash
curl -X POST http://127.0.0.1:8000/webhook/{workflow_id} \
  -H "Content-Type: application/json" \
  -d '{"job_url": "https://example.com/jobs/123"}'
```

**Cron scheduling** — standard cron expressions in the Triggers panel. If a run is already in progress when a trigger fires, that firing is skipped.

**Multi-LLM** — any model via LiteLLM, set globally or per node:
```
gemini-3-flash-preview   openai/gpt-4o   anthropic/claude-opus-4-7
openrouter/...           ollama/llama3
```

**Secrets** — stored in the local SQLite database, referenced as `{{secrets.KEY}}`, never returned by the API after saving.

**MCP servers** — attach a tool server (stdio or SSE) to any node to give the agent extra capabilities like filesystem access or custom APIs.

**Human-in-the-loop** — enable per-step confirmation to review each action before it fires.

**Take Over / Hand Back** — pause the agent at any point, control the browser yourself, resume when ready.

**Run logs** — every run is logged to `/workspace/logs/`. Stream output live in the UI or browse past runs.


## LLM providers

| Provider | Secret key |
|-|--|
| Gemini (default) | `GEMINI_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama | no key needed |


## Data

Everything is in `./workspace` — a bind mount that survives restarts and rebuilds.

```bash
cp -r ./workspace ./workspace-backup   # backup
git pull && docker compose up --build  # upgrade
```


## Ports

| Port | Service |
|---|---|
| `3000` | Frontend |
| `8000` | Backend API (Swagger at `/docs`) |
| `6080` | noVNC |
| `7878` | OculOS daemon |



Built on [orbit-cua]([https://pypi.org/project/orbit-cua/](https://github.com/aadya940/orbit)
