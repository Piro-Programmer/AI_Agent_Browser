# Sahayak — AI Browser Agent

A Chrome side-panel assistant that reads the page you are on, explains and summarises it, and (in later phases) helps you act on it — **one approved step at a time**.

Built as a Manifest V3 extension with React, TypeScript and Vite, powered by Google Gemini.

---

## Contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Add your Gemini API key](#add-your-gemini-api-key)
4. [How it works](#how-it-works)
5. [Project structure](#project-structure)
6. [Permissions](#permissions)
7. [Security & privacy](#security--privacy)
8. [Roadmap](#roadmap)
9. [Testing checklist](#testing-checklist)

---

## Features

| Feature | Status |
|---|---|
| Side panel that opens next to any tab | Done |
| Settings tab to save your Gemini API key locally | Done |
| Tab tracking with "tab switched" and "tab closed" alerts | Done |
| Panel ↔ background ↔ page messaging with timeouts | Done |
| Gemini connection test with model, latency and token count | Done |
| Explain selected text | Next |
| Article and YouTube summaries, English / Hinglish | Planned (Phase 1) |
| Page chat, right-click actions, screenshot Q&A | Planned (Phase 2) |
| Approval-based agent (find, click, type) with safety rules | Planned (Phase 3) |
| Profile memory, saved skills, release ZIP | Planned (Phase 4) |

---

## Quick start

**Requirements:** Node.js 20+ and desktop Google Chrome.

```bash
git clone https://github.com/Piro-Programmer/AI_Agent_Browser.git
cd AI_Agent_Browser
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist` folder.
4. Pin Sahayak and click its icon — the side panel opens.

For development, use `npm run dev` instead of `npm run build`. It rebuilds `dist/` on every change; reload the extension in `chrome://extensions` to pick up background-script changes.

---

## Add your Gemini API key

1. Get a free key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Open the side panel → **Settings** → paste the key → **Save**.
3. Click **Test connection** to confirm it works.

The key is stored only in `chrome.storage.local` on your machine.

**Dev shortcut (optional):** copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY`. This is read **only** by `npm run dev`; production builds never include it, so `dist/` is safe to zip and share.

---

## How it works

```
 Side panel (React UI)  ──►  Gemini REST API
        │
        ▼
 Background service worker  ──►  Content script (in the web page)
```

- **Side panel** — the UI. It calls Gemini directly, so your key never touches the web page.
- **Background service worker** — routes messages, tracks the active tab, and re-injects the content script if a tab was open before the extension loaded.
- **Content script** — reads page information. It never stores keys or calls AI services.

**Model routing** (`src/shared/ai/router.ts`):

| Task | Model |
|---|---|
| Everyday reading, summaries, connection test | `gemini-3.5-flash-lite` |
| Screenshots and agent steps | `gemini-3.5-flash` |
| Fallback if a model is retired | `gemini-flash-lite-latest` |

---

## Project structure

```
src/
  background/        Service worker: message router, tab lookup, script injection
  content/           Content script: page bridge
  sidepanel/         React UI
    hooks/           useTabContext (tab binding and connection status)
    views/           Home, Settings
  shared/
    ai/              Gemini provider, model router, key manager
    prompts/         System prompt and language options
    messages.ts      Typed messages shared by all parts
public/icons/        Extension icons
docs/                Problem statement, architecture, plan, edge cases
```

---

## Permissions

| Permission | Why it is needed |
|---|---|
| `sidePanel` | Show the Sahayak panel next to the page |
| `storage` | Save your API key and settings locally |
| `tabs` | Read the active tab's title and URL, detect tab switches |
| `activeTab` | Access the current tab when you open Sahayak |
| `scripting` | Inject the content script into tabs opened before install |
| `http://*/*`, `https://*/*` | Talk to pages and to the Gemini API |

---

## Security & privacy

- API keys are never committed — `.env` and `dist/` are git-ignored.
- The key is sent to Google in a request header, not in the URL.
- Browser system pages (`chrome://`, Web Store) are detected and left alone.
- Planned: every agent action needs your approval; banking, payment, password, OTP and card fields will be blocked in code.

---

## Roadmap

| Phase | Theme | Highlights |
|---|---|---|
| 1 | Read | Explain selection, article and YouTube summaries, English / Hinglish |
| 2 | Understand | Page chat, streaming, right-click actions, screenshot Q&A, rate-limit fallback |
| 3 | Act with approval | Element scanner, numbered badges, find-it, step-by-step agent, action log |
| 4 | Remember & ship | Profile, saved skills, safety hardening, release ZIP, landing page |

Full slice-by-slice plan: [docs/implementation-plan.md](./docs/implementation-plan.md).

---

## Testing checklist

- [ ] Extension loads with no errors in `chrome://extensions`.
- [ ] Clicking the icon opens the side panel.
- [ ] **Settings:** an invalid key shows a friendly error; a valid key shows the model name and latency.
- [ ] **Home:** the tab card shows the current page and "Content Script Connected".
- [ ] Switching tabs shows the "Active tab switched" banner.
- [ ] Opening a `chrome://` page shows "Restricted Browser Page".
- [ ] "Try Gemini connection" returns a response with token count.

---

## License

No license has been added yet.
