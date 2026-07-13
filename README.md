# LLM Playground

A standalone multi-model chat UI inspired by the Vourix Hermes playground: composer at the bottom, model picker in the toolbar, streaming replies, and a simple artifact panel for downloadable docs.

This is a **plain LLM chat** over [OpenRouter](https://openrouter.ai) (`/v1/chat/completions`). It is **not** an agent runtime — no tools, skills, or workspace deliver backend.

## Features

- Playground-style layout (centered transcript, sticky composer, dot-grid background)
- Model picker in the composer toolbar — **Suggested** and **Search** over the OpenRouter catalog
- Streaming chat completions
- Browser prompt for your OpenRouter API key (stored in `localStorage`)
- **Artifacts**: ask for a document and get a side-panel preview + download (no agent tools required)
- Selected model remembered across reloads

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first load you’ll be asked for an [OpenRouter API key](https://openrouter.ai/keys). Paste it in the dialog — it’s kept only in this browser. You can update or clear it from the header anytime.

```bash
npm run build   # production build
npm start       # serve the production build
```

## API key

| How | Details |
|-----|---------|
| **UI (recommended)** | Prompt on first visit → saved in `localStorage` → sent as `x-openrouter-api-key` to the Next.js API routes |
| **Server env (optional)** | Set `OPENROUTER_API_KEY` in `.env.local` as a fallback if the browser has no key |

Copy `.env.example` to `.env.local` only if you want the server-side fallback:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | No | Server fallback API key |
| `OPENROUTER_HTTP_REFERER` | No | Referer shown in OpenRouter dashboards |
| `OPENROUTER_APP_TITLE` | No | App title sent to OpenRouter |

## Artifacts (downloadable docs)

When you ask the model to write or export a document, a system prompt instructs it to wrap file bodies in named fences:

````markdown
```file:quarterly-summary.md
# Quarterly summary
...
```
````

The UI:

1. Parses those fences from the assistant reply  
2. Opens a side panel with preview (markdown / HTML / code)  
3. Lets you download the file from the browser  

No special “file deliver” backend is required — the LLM returns the content, and the client turns it into a downloadable blob.

Try: *“Write a one-page project brief as a markdown file.”*

## Project structure

```
src/
  app/
    api/chat/route.ts      # Proxies streaming chat/completions to OpenRouter
    api/models/route.ts    # Loads the OpenRouter model catalog
    page.tsx
  components/
    chat-playground.tsx    # Main chat UI
    model-picker.tsx       # Suggested / Search model popover
    artifact-panel.tsx     # Preview + download rail
    api-key-dialog.tsx     # First-run / settings key prompt
  lib/
    artifacts.ts           # Fence parsing + download helpers
    models.ts              # Model types + fallback catalog
```

## Publish as its own GitHub repo

This folder is self-contained:

```bash
cd llm-playground-mock   # or rename the folder first
git init
git add .
git commit -m "Initial commit: multi-model LLM playground"
gh repo create llm-playground --public --source=. --remote=origin --push
```

Or create an empty repo on GitHub, then add the remote and push.

## Notes

- Without a key, a small curated fallback model list still loads; chat and the full catalog need a valid OpenRouter key.
- Models are fetched from OpenRouter’s public catalog when authenticated.
- This intentionally omits agent features (tools, runtime feed, workspace deliver, subagents).
