# Orbit Studio

**Visual workflow builder for browser AI agents.**

Draw a graph, describe what you want in plain English, and watch a real browser do it — scraping, form-filling, clicking, extracting. Schedule it. Webhook it. Walk away.

---

## What people build with it

- **Competitive research** — scrape pricing, models, and features across multiple sites; pipe results into a live analysis
- **Job applications** — navigate LinkedIn, filter listings, fill and submit applications on autopilot
- **Data extraction** — pull structured data from any page into JSON or CSV, no brittle selectors required
- **Monitoring** — check pages on a schedule, branch on conditions, retry until something changes
- **Batch automation** — feed a CSV in, get results out, one row at a time

---

## How it works

You build a workflow as a graph of nodes. The agent runs each step inside a sandboxed Docker VM with a full Chrome browser. Watch it work live over VNC, take manual control at any point, then hand back.

Trigger runs manually from the UI, via webhook, or on a cron schedule.

---

## Quick start

```bash
git clone https://github.com/aadya940/orbit-ui
cd orbit-ui

cp .env.example .env
# Set GEMINI_API_KEY — or any supported LLM key

docker compose up
```

Open **http://127.0.0.1:3000**

> **Windows users:** use `127.0.0.1` — `localhost` resolves to IPv6 on Windows and won't connect.

---

## Nodes

| Node | What it does |
|------|-------------|
| `Navigate` | Open a URL — supports template variables like `{{inputs.url}}` |
| `Do` | Describe any action in plain English. Clicks, scrolls, typing — the agent figures it out. |
| `Read` | Extract structured data from the current page. Define an output schema to get typed fields. |
| `Fill` | Fill a form with a field → value map. Use `{{secrets.PASSWORD}}` for credentials. |
| `Check` | Ask a yes/no question about the screen. Routes to a true or false path. |
| `ForEach` | Iterate over a list. Connect body nodes to the loop handle, post-loop nodes to done. |
| `Code` | Run arbitrary Python inline. Full access to all workflow variables and outputs. |
| `Agent` | Custom verb — bring your own class and prompt template. |
| `Bootstrap` | Install system packages via `apt-get` before the graph runs. No LLM involved. |

---

## Features

**Structured extraction** — add an Output Schema to any Read or Do node to get back typed, validated fields instead of raw text. Reference them downstream as `{{node_id.field}}`.

**Workflow inputs** — declare named parameters (`job_url`, `email`, etc.) and reference them as `{{inputs.name}}` anywhere. Provide values at run time via the UI, webhook payload, or cron config.

**Webhook triggers** — every workflow gets a stable POST endpoint:
```bash
curl -X POST http://127.0.0.1:8000/webhook/{workflow_id} \
  -H "Content-Type: application/json" \
  -d '{"job_url": "https://example.com/jobs/123"}'
```

**Cron scheduling** — set expressions like `0 9 * * 1-5` in the Triggers panel. The scheduler fires automatically, skips if a run is already in progress.

**Multi-LLM** — any model via LiteLLM, set globally or overridden per node:
```
gemini-3-flash-preview   openai/gpt-4o   anthropic/claude-opus-4-7
openrouter/...           ollama/llama3
```

**Secrets vault** — store API keys and passwords, reference as `{{secrets.KEY}}`. Values are never returned by the API after saving.

**MCP servers** — attach any MCP-compatible tool server to a node (stdio or SSE). Give the agent filesystem access, database queries, or custom APIs mid-workflow.

**Human-in-the-loop** — enable per-step confirmation to review every action before it fires. Toggle off for fully autonomous runs.

**Take Over / Hand Back** — click Take Over at any point to pause the agent and drive the browser yourself. Click Hand Back to return control. The agent resumes from where it left off.

**Run history** — every run is logged. Stream output live, or browse past runs and replay their outputs.

---

## LLM providers

| Provider | Secret key |
|----------|-----------|
| Gemini (default) | `GEMINI_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama | no key needed |

Add keys in the Secrets panel (lock icon in the top bar) or directly in `.env`.

---

## Persistence & upgrades

Everything lives in `./workspace` — a bind-mounted directory that survives restarts and rebuilds.

```bash
# Backup
cp -r ./workspace ./workspace-backup

# Upgrade (data preserved)
git pull && docker compose up --build
```

---

## Ports

| Port | Service |
|------|---------|
| `3000` | Frontend UI |
| `8000` | Backend API + Swagger at `/docs` |
| `6080` | noVNC — live browser view |
| `7878` | OculOS daemon |

---

Built on [orbit-cua](https://pypi.org/project/orbit-cua/) · [PyPI](https://pypi.org/project/orbit-cua/)
