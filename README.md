# Orbit Studio

A self-hosted tool for building computer use workflows on a real desktop inside Docker.

[![Demo](https://img.youtube.com/vi/R4SlZ8LntcU/maxresdefault.jpg)](https://youtu.be/R4SlZ8LntcU)

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
