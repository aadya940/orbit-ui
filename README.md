# Orbit Studio

Visual workflow automation for any desktop app — not just the browser.

Built on [orbit-cua](https://github.com/aadya940/orbit), a computer-use automation library that uses AT-SPI + screenshots to interact with any GUI application.

## What it does

- **Visual workflow builder** — drag-and-drop nodes (Navigate, Do, Check, Fill, Read, Code, Agent) to build automation workflows
- **Retry loops with verification** — Check nodes verify outcomes using LLM; loop-back edges retry with context until success or max iterations
- **Any desktop app** — AT-SPI makes this work on legacy ERP, thick clients, government portals — anything with a GUI
- **Run history & live logs** — every run is recorded; logs stream live to the UI
- **File manager** — upload files into the VM, download outputs to your machine
- **Secrets management** — API keys and credentials stored in SQLite, never exposed in the UI
- **Any LLM** — LiteLLM-compatible model strings (`gemini-2.5-flash`, `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, etc.)

## Quick start

**Prerequisites:** Docker Desktop

```bash
git clone https://github.com/aadya940/orbit-ui.git
cd orbit-ui
cp .env.example .env
# Edit .env and add your API key
docker compose up --build
```

Then open:
- **UI** → http://localhost:3000
- **Desktop** → http://localhost:6080 (noVNC, see the VM running)

## Architecture

```
┌─────────────────────────────────┐    ┌──────────────────────────────┐
│  vm                             │    │  ui                          │
│  Ubuntu 24.04 + XFCE + AT-SPI  │    │  React + nginx               │
│  :6080  noVNC desktop           │    │  :3000                       │
│  :7878  OculOS daemon           │    │                              │
│  :8000  FastAPI backend         │    └──────────────────────────────┘
└─────────────────────────────────┘
         workspace/ (Docker volume)
         ├── orbit.db        workflows, secrets, run history
         ├── workflow.py     auto-generated before each run
         ├── runs/           per-run log files
         └── uploads/        files you copy into the VM
```

The `vm` service is the unit of scale — future multi-VM support via `docker compose up --scale vm=N`.

## Node types

| Node | What it does |
|------|-------------|
| **Navigate** | Open a URL or launch an application |
| **Do** | Perform a task described in plain English |
| **Check** | Verify a condition is true/false (used for branching and retry loops) |
| **Fill** | Fill a form with structured data |
| **Read** | Extract structured data from the screen |
| **Code** | Run arbitrary Python inside the workflow |
| **Agent** | Define a custom agent verb with its own prompt template |

## Workflow example

```
Navigate → "Open SAP"
Do       → "Go to the purchase orders report for last month"
Read     → Extract {vendor, amount, status} for each row
Code     → Write results to /workspace/output.csv
```

With a loop:
```
Navigate → "Open the form"
Do       → "Fill in the fields and submit"
Check    → "Was the submission successful?"  ← loop back to Do if false (max 3×)
```

## Tech stack

- **Backend** — FastAPI, SQLite, orbit-cua
- **Frontend** — React, Vite, React Flow
- **VM** — Ubuntu 24.04, XFCE4, Xvfb, AT-SPI, noVNC
- **LLM** — Any LiteLLM-compatible provider

## License

MIT
