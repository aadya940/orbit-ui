# Orbit Studio

A self-hosted tool for building computer use workflows on a real desktop inside Docker.

[![▶ Watch Demo](https://img.youtube.com/vi/R4SlZ8LntcU/maxresdefault.jpg)](https://youtu.be/R4SlZ8LntcU)

▶ [Watch the demo](https://youtu.be/R4SlZ8LntcU)

## What it does

- Scrape structured data from websites
- Fill and submit forms using credentials from a secrets vault
- Run Python inline with access to all previous step outputs
- Monitor pages on a schedule and branch based on what's on screen
- Chain any of the above into a single workflow

Runs in a Docker container with a full browser and desktop. You can watch it work over VNC, pause and take control, then hand back.

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

---

**Docs & more:** [orbit-cua.com](https://orbit-cua.com)
