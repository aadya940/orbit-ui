# Orbit Studio

Visual workflow automation for any desktop app, not just the browser.

![demo](docs/demo.gif)

## Why not n8n, Playwright, or UiPath?

n8n and Zapier only automate things that have APIs. Playwright only works in the browser. UiPath costs $15k/year and requires a Windows server. Orbit Studio uses AT-SPI, the Linux accessibility layer, which means it can interact with any GUI application at the OS level: SAP, Oracle Forms, legacy thick clients, government portals, internal tools built in 2003. If a human can click it, Orbit can automate it.

## Quick start

```bash
git clone https://github.com/aadya940/orbit-ui.git
cd orbit-ui
cp .env.example .env        # add your API key, then:
docker compose up --build
```

Open the UI at `http://localhost:3000`. Watch the VM at `http://localhost:6080`.

## Node types

| Node | What it does |
|------|-------------|
| **Navigate** | Open a URL or launch an application |
| **Do** | Perform a task described in plain English |
| **Check** | Verify a condition (used for branching and retry loops) |
| **Fill** | Fill a form with structured data |
| **Read** | Extract structured data from the screen |
| **ForEach** | Iterate over any Python iterable (CSV rows, JSON arrays, node output) |
| **Code** | Run arbitrary Python inside the workflow |
| **Agent** | Define a custom agent verb with its own prompt template |

## How retry loops work

Most RPA tools retry by blindly re-running the same action. Orbit retries with understanding. A Check node asks the LLM whether the goal was actually achieved. If it was not, the loop runs the action again with full context of what happened. You set the max iterations. This makes workflows resilient to slow pages, timing issues, and transient errors without writing any error handling code.

## Architecture

```
backend/    FastAPI + SQLite + orbit-cua (runs inside Docker VM)
frontend/   React + Vite + React Flow (served via nginx)
```

```
workspace/ (Docker volume, persists across rebuilds)
├── orbit.db       workflows, secrets, run history
├── workflow.py    auto-generated before each run
├── runs/          per-run log files
└── uploads/       files you copy into the VM
```

## Supported LLMs

Any [LiteLLM-compatible](https://docs.litellm.ai/docs/providers) model string:

```
gemini-2.5-flash
openai/gpt-4o
anthropic/claude-3-5-sonnet-20241022
openrouter/google/gemini-flash-1.5
```

## License

MIT
