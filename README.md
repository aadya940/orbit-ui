# Orbit Studio

**Demo:** https://youtu.be/R4SlZ8LntcU

A self-hosted tool for building computer use workflows. Draw a graph of steps, describe what each step should do, and an AI agent executes them on a real desktop inside Docker.

Works with any GUI app — browser, terminal, or desktop software. Chrome login sessions persist across restarts via a named Docker volume.

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

## More information

**https://orbit-cua.com**
