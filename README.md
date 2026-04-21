# Orbit Studio

Build browser automation workflows visually. Connect nodes, run an AI agent, watch it work in a real browser — then schedule it to run on its own.


---

## What it's for

- **Job applications** — navigate LinkedIn, filter listings, fill and submit applications automatically
- **Web scraping** — extract structured data from any page into JSON or CSV
- **Form automation** — log in, fill forms, submit — using credentials from an encrypted vault
- **Monitoring** — check pages on a schedule, branch on conditions, retry until something changes
- **Batch processing** — iterate over a CSV row by row, perform an action per item

---

## How it works

You build a workflow as a graph of nodes — Navigate, Do, Read, Fill, Check, ForEach, Code. The agent executes each step in a sandboxed VM with a real browser. You watch it happen live, can take over manually at any point, and hand back when you're done.

Trigger workflows manually, via webhook, or on a cron schedule.

---

## Quick start

```bash
git clone https://github.com/your-org/orbit-studio
cd orbit-studio

cp .env.example .env
# Add your GEMINI_API_KEY (or any supported LLM key)

docker compose up
```

Open **http://localhost:3000**

---

## Nodes

| Node | What it does |
|------|-------------|
| `Navigate` | Open a URL |
| `Do` | Describe an action in plain English |
| `Read` | Extract structured data from the page |
| `Fill` | Fill a form with field → value pairs |
| `Check` | Branch on a yes/no condition |
| `ForEach` | Iterate over a list |
| `Code` | Run Python inline |
| `Agent` | Custom verb with your own prompt template |

---

## Features

**Workflow inputs** — declare parameters like `job_url` or `email`, reference them as `{{inputs.job_url}}` in any node. Pass values at run time via the UI, webhook, or cron.

**Webhook triggers** — every workflow gets a stable endpoint:
```bash
curl -X POST http://localhost:8000/webhook/{workflow_id} \
  -H "Content-Type: application/json" \
  -d '{"job_url": "https://example.com/jobs/123"}'
```

**Cron scheduling** — set expressions like `0 9 * * 1-5` in the Triggers panel. The scheduler fires them automatically.

**Multi-LLM** — use any model via LiteLLM. Set globally or override per node:
```
gemini-3-flash-preview  |  openai/gpt-4o  |  anthropic/claude-3-5-sonnet-20241022
openrouter/...          |  ollama/llama3
```

**Secrets vault** — store API keys and passwords, reference as `{{secrets.KEY}}`. Never returned by the API after saving.

**MCP servers** — attach any MCP tool server to a node (stdio or SSE). Gives the agent file system access, database queries, custom APIs.

**Run history** — every run is logged. Stream logs live, or browse past runs and their outputs.

**Take Over** — pause the agent mid-run, control the browser yourself, hand back. The agent resumes from where it left off.

---

## Supported LLM keys

| Provider | Secret key |
|----------|-----------|
| Gemini (default) | `GEMINI_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama | no key needed |

Add keys in the Secrets panel (lock icon in the top bar) or in your `.env`.

---

## Data persistence

All workflows, logs, secrets, and uploaded files live in `./workspace` — a bind-mounted directory that persists across restarts and rebuilds.

```bash
# Backup
cp -r ./workspace ./workspace-backup

# Upgrade
git pull && docker compose up --build
```

---

## Ports

| Port | Service |
|------|---------|
| `3000` | Frontend |
| `8000` | Backend API |
| `6080` | noVNC (VM viewer) |
| `7878` | OculOS daemon |

---

Built on [orbit-cua](https://pypi.org/project/orbit-cua/) · [PyPI](https://pypi.org/project/orbit-cua/)
