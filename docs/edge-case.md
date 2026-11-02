# Sahayak — Edge Cases & Corner Scenarios

This document lists **corner cases** that can break Sahayak during implementation. Use it alongside [implementation-plan.md](./implementation-plan.md) and [architecture.md](./architecture.md). When you hit a bug in manual testing, add a row here so the team does not re-discover it.

**Legend**

| Severity | Meaning |
|----------|---------|
| **P0** | Wrong action, leak of secrets, or data sent to model when it must not |
| **P1** | Feature broken or crash; user loses trust |
| **P2** | Degraded UX; workaround exists |
| **P3** | Rare; document and fix if time allows |

**Columns in tables:** *Scenario* · *Expected behavior* · *Slice / area*

---

## 1. Cross-cutting (all phases)

| ID | Sev | Scenario | Expected behavior | Slice / area |
|----|-----|----------|---------------------|--------------|
| X-01 | P1 | Service worker was stopped (idle timeout) mid-request | Caller gets timeout error; UI offers Retry; no hung spinner forever | 1.2+ |
| X-02 | P1 | `chrome.runtime.lastError` after tab closed | Message fails gracefully: “Tab closed” | 1.2+ |
| X-03 | P1 | Content script not injected (`chrome://`, Web Store, PDF viewer, new tab) | Explain missing CS: offer “Reload tab” or inject via `scripting` on user click | 1.2 |
| X-04 | P2 | Restricted URL (`chrome://extensions`, `edge://`, file:// if not granted) | Read features disabled with clear reason; agent never starts | 1.2, 3.9 |
| X-05 | P1 | Side panel open but user switches active tab | Banner: context may be stale; “Refresh context” re-binds `tabId` | 1.2 |
| X-06 | P2 | Two windows, panel tied to window A, user focuses window B | Panel shows which window/tab it is bound to; refresh updates | 1.2 |
| X-07 | P1 | Duplicate message handlers / missing `return true` for async SW reply | No double responses; async responses use `sendResponse` correctly | 1.2 |
| X-08 | P2 | `requestId` collision or missing correlation | UI ignores orphan responses; only matching `requestId` updates state | 1.2 |
| X-09 | P0 | Page script tries to read extension messages | Content script does not expose keys or model output on `window` | All |
| X-10 | P1 | Extension reload/update during active chat | In-flight requests cancelled; user sees “Extension reloaded” | 1.3+ |
| X-11 | P2 | `chrome.storage.local` quota exceeded (large skills export history) | Catch `QUOTA_BYTES`; prompt to delete old logs/skills | 4.2, 3.8 |
| X-12 | P2 | User clears site data / uninstalls extension | Document that profile and keys are lost; no silent recovery | 4.6 README |
| X-13 | P1 | Incognito window if extension not allowed in incognito | Manifest choice documented; features unavailable in incognito with message | 1.1 |
| X-14 | P2 | Very slow machine: IPC &gt; 500 ms | Loading states; no double-submit on Summarise | 1.2 |
| X-15 | P1 | Panel closed while SW still processing | Result dropped or queued to storage notification on next open (define one policy) | 2.1 |

---

## 2. Phase 1 — Foundation & summarisation

### Slice 1.1 — Extension shell + settings

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.1-01 | P1 | Empty API key saved | Block AI actions; Settings highlights required field | 1.1 |
| 1.1-02 | P0 | API key pasted into README/screenshot for demo | Docs warn to blur; grep CI catches committed keys | 4.5 |
| 1.1-03 | P2 | Key with leading/trailing whitespace | Trim on save | 1.1 |
| 1.1-04 | P2 | Side panel API unavailable (old Chromium fork) | README states Chrome desktop minimum version | 1.1 |
| 1.1-05 | P2 | User opens panel before first install grant | No crash; default settings | 1.1 |

### Slice 1.2 — IPC + tab context

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.2-01 | P1 | SPA never fires full navigation; CS loaded at old URL | Stale URL in panel until refresh; optional `popstate` listener in CS | 1.2 |
| 1.2-02 | P1 | Tab discards (Chrome memory saver) | Ping fails; prompt user to focus tab | 1.2 |
| 1.2-03 | P2 | Page iframe-heavy; CS only top frame | Document: context is top frame only unless extended | 1.2 |
| 1.2-04 | P1 | Message to wrong `tabId` after rapid tab switch | Reject or no-op with error | 1.2 |

### Slice 1.3 — Gemini (panel)

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.3-01 | P1 | Invalid API key (401/403) | “Check API key in Settings”; no stack trace in UI | 1.3 |
| 1.3-02 | P1 | Network offline | Clear offline message; retry button | 1.3 |
| 1.3-03 | P2 | CORS misconfiguration if calling API wrong from panel | Use documented Gemini endpoint for browser extensions / REST pattern that works in extension pages | 1.3 |
| 1.3-04 | P2 | Model id deprecated or renamed | Config constant; README note to update model string | 1.3 |
| 1.3-05 | P1 | Response blocked by corporate proxy | Show network error, not infinite loading | 1.3 |

### Slice 1.4 — Explain selection

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.4-01 | P2 | No selection / collapsed selection | Button disabled or “Select text on the page first” | 1.4 |
| 1.4-02 | P2 | Selection inside `contenteditable` or shadow DOM | Best-effort via scripting; fallback paste hint | 1.4 |
| 1.4-03 | P1 | Selection is huge (whole article) | Warn or truncate before send; respect token budget | 1.4 |
| 1.4-04 | P2 | Selection only whitespace | Reject client-side | 1.4 |
| 1.4-05 | P2 | Cross-origin iframe selection | Empty selection; explain limitation | 1.4 |

### Slice 1.5 — Readability extraction

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.5-01 | P1 | Paywall shows snippet only in DOM | Summarise visible text only; do not claim full article | 1.5 |
| 1.5-02 | P2 | Infinite scroll / lazy-loaded body | May miss below-fold content; optional “scroll to load” hint | 1.5 |
| 1.5-03 | P2 | Readability returns null (search results, app UI) | “No article detected” | 1.5 |
| 1.5-04 | P1 | `document.cloneNode` breaks on huge DOM | Timeout guard; truncate or abort with message | 1.5 |
| 1.5-05 | P2 | Duplicate sidebars in cloned doc | Accept imperfect extraction; user can chat with snapshot fallback | 1.5, 2.1 |
| 1.5-06 | P0 | Article contains PII user did not intend to send | User initiates action; optional sensitive URL warning (Phase 4) | 4.4 |

### Slice 1.6 — Article summary

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.6-01 | P2 | Model returns prose without required sections | Parser fills partial UI; “Regenerate” | 1.6 |
| 1.6-02 | P2 | Model hallucinates fifth bullet not in article | Grounding prompt + user education; chat can verify | 1.6, 2.1 |
| 1.6-03 | P1 | Article text exceeds context window | Truncate with `[truncated]`; summary notes limitation | 1.5 |
| 1.6-04 | P2 | Non-English article | Summarise in user’s output language (EN/Hinglish), not necessarily translate source | 1.8 |
| 1.6-05 | P2 | User clicks Summarise twice quickly | Debounce / disable button during in-flight request | 1.6 |

### Slice 1.7 — YouTube summary

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.7-01 | P2 | URL is `youtu.be` short link | Normalize to watch URL before API | 1.7 |
| 1.7-02 | P2 | Playlist / shorts / live stream | Clear supported vs unsupported messaging | 1.7 |
| 1.7-03 | P1 | Private, age-gated, or members-only video | “Unsupported”; no fake summary | 1.7 |
| 1.7-04 | P2 | Model invents timestamps | Render timestamps only if parsed reliably; label as approximate | 1.7 |
| 1.7-05 | P2 | Tab is YouTube but user pasted different URL | Prefer explicit paste over tab when both present (define UX) | 1.7 |
| 1.7-06 | P2 | API does not accept YouTube URL on free tier | Fallback: title + description from oEmbed or page meta only | 1.7 |

### Slice 1.8 — English / Hinglish

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 1.8-01 | P2 | Toggle changed mid-stream | Stream completes in old language or cancel and restart (pick one) | 1.8, 2.2 |
| 1.8-02 | P3 | Model drifts into Hindi Devanagari when Hinglish requested | System prompt: romanized Hinglish | 1.8 |
| 1.8-03 | P2 | Language pref out of sync between panel and storage | Load from storage on panel mount | 1.8 |

---

## 3. Phase 2 — Page brain & screen

### Slice 2.1 — Grounded page chat

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 2.1-01 | P1 | User asks about prior knowledge (capital of France) | Refuse outside page; cite grounding rules | 2.1 |
| 2.1-02 | P2 | Page context stale after in-page update (React rerender) | “Refresh context” before answer | 2.1 |
| 2.1-03 | P1 | Chat history exceeds token limit | Drop middle turns or summarize old turns; keep system + page excerpt | 2.1 |
| 2.1-04 | P2 | Empty page / blank document | Chat explains no content | 2.1 |
| 2.1-05 | P2 | Same question repeated | Allow; answers consistent with page | 2.1 |

### Slice 2.2 — Streaming

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 2.2-01 | P1 | Stream interrupted mid-response | Show partial text + “Response incomplete” | 2.2 |
| 2.2-02 | P2 | User clicks Cancel during stream | Abort fetch; stop UI updates | 2.2 |
| 2.2-03 | P2 | Streaming unsupported; fallback works | Non-streaming path auto-used | 2.2 |
| 2.2-04 | P2 | Markdown/code in stream breaks layout | Sanitize or plain-text render | 2.2 |

### Slice 2.3 — Context menu

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 2.3-01 | P2 | Right-click without selection | Menu hidden or disabled items | 2.3 |
| 2.3-02 | P1 | Panel not open; message sent before panel listens | Queue in SW or storage flag; panel reads on mount | 2.3 |
| 2.3-03 | P2 | Selection in PDF or canvas | Empty selection; open panel with hint | 2.3 |
| 2.3-04 | P2 | Context menu on chrome-extension:// page | No injection | 2.3 |
| 2.3-05 | P2 | Duplicate menu entries after reload extension | `contextMenus.removeAll` on install/update | 2.3 |

### Slice 2.4 — Screenshot-and-ask

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 2.4-01 | P1 | `captureVisibleTab` fails (missing `tabs` permission or inactive tab) | Error: focus tab and retry | 2.4 |
| 2.4-02 | P2 | Retina / high-DPI huge PNG | Compress JPEG quality; max dimension downscale | 2.4 |
| 2.4-03 | P2 | Screenshot includes sensitive notification overlay | User responsibility; optional blur warning in UI | 2.4 |
| 2.4-04 | P1 | Vision model refuses or returns empty | Show error; suggest rephrase | 2.4 |
| 2.4-05 | P2 | Side panel visible in capture (split view) | Document: capture is full tab viewport; crop stretch reduces this | 2.4b |
| 2.4-06 | P0 | Screenshot of banking app sent to model | Phase 4: warn/block sensitive URLs for cloud send | 4.4 |
| 2.4-07 | P2 | HW acceleration black frame in capture | Retry; document known Chrome bugs | 2.4 |

### Slice 2.5 — AIRouter + Groq fallback

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 2.5-01 | P1 | HTTP 429 from Gemini | Backoff + user message; try Flash only if policy says so | 2.5 |
| 2.5-02 | P1 | Both Gemini and Groq fail | Actionable error; extension stays up | 2.5 |
| 2.5-03 | P2 | Groq key missing but Gemini failed | Say “Add Groq key for fallback” | 2.5 |
| 2.5-04 | P1 | Fallback used for agent JSON (unreliable) | **Do not** use Groq for agent/find-it; Gemini only from SW | 3.3, 3.4 |
| 2.5-05 | P2 | Retry storm amplifies rate limit | Max retries cap; jitter | 2.5 |
| 2.5-06 | P2 | Partial JSON from model on retry | Zod fail → one repair retry → error | 2.5, 3.4 |

---

## 4. Phase 3 — Hands with approval

### Slice 3.1 — Scanner

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.1-01 | P1 | Duplicate visible buttons (responsive hide/show) | Stable numbering after refresh; document reorder on resize | 3.1 |
| 3.1-02 | P2 | 500+ interactives on page | Cap N max; warn “map truncated” | 3.1 |
| 3.1-03 | P2 | Custom dropdown (div-based, not `<select>`) | Include via role/heuristic; may miss some | 3.1 |
| 3.1-04 | P1 | `targetId` points to zero-size element | Executor fails safely; log error | 3.6 |
| 3.1-05 | P2 | Element behind modal overlay | Visibility filter excludes or marks low confidence | 3.1 |
| 3.1-06 | P0 | Password field numbered as type target | Mark blocked; no type value in map | 3.1, 3.5 |
| 3.1-07 | P2 | Shadow DOM closed components | May not see inner controls; document limitation | 3.1 |
| 3.1-08 | P2 | WeakRef collected before execute | Re-resolve by id from fresh map; fail if id gone | 3.6 |

### Slice 3.2 — Badges

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.2-01 | P2 | Badges misaligned on zoom ≠ 100% | Recalc on resize/zoom | 3.2 |
| 3.2-02 | P2 | Fixed/sticky header covers badges | z-index policy; scroll into view on highlight | 3.2 |
| 3.2-03 | P2 | Site CSP blocks shadow DOM styles | Fallback overlay styles inline in isolated root | 3.2 |
| 3.2-04 | P3 | Badge overlaps important UI | Toggle hide badges | 3.2 |
| 3.2-05 | P2 | Virtual list unmounts nodes | Map refresh after scroll stops | 3.1 |

### Slice 3.3 — Find-it

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.3-01 | P1 | Model returns invalid JSON | No highlight; show parse error | 3.3 |
| 3.3-02 | P1 | Model returns id not in map | Reject; ask to refresh map | 3.3 |
| 3.3-03 | P2 | Ambiguous query (two “Submit” buttons) | Model picks one; show reason; user can retry | 3.3 |
| 3.3-04 | P2 | Query asks to click, not find | Find-it does not click; agent flow separate | 3.3 |

### Slice 3.4 — Agent FSM

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.4-01 | P0 | Approve pressed with no pending proposal | No-op | 3.4 |
| 3.4-02 | P1 | Model proposes `done` immediately | End task; show summary in log | 3.4 |
| 3.4-03 | P1 | Model proposes click on `href` navigation | User sees reason; approval required before navigation | 3.4 |
| 3.4-04 | P2 | Skip loops forever on same bad state | Optional max skips or escalate to Stop | 3.4 |
| 3.4-05 | P1 | Planning state re-entered while API in flight | Ignore duplicate or cancel previous | 3.4 |
| 3.4-06 | P2 | Task description injection in prompt | Treat as data; safety still in code | 3.4 |

### Slice 3.5 — SafetyEngine

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.5-01 | P0 | `type` into OTP field disguised as text | Heuristics block; log blocked | 3.5, 4.4 |
| 3.5-02 | P0 | Agent on payment URL substring false negative | Expand blocklist tests; `/pay` path edge cases | 4.4 |
| 3.5-03 | P1 | Consequential button label in non-English | Extend regex or use accessible name only | 4.4 |
| 3.5-04 | P1 | `requireExtraConfirm` user dismisses modal | Treat as cancel; do not execute | 3.7 |
| 3.5-05 | P0 | Model proposes typing card number in generic text field | Block patterns for PAN/card-like values | 4.4 |

### Slice 3.6 — Executor

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.6-01 | P1 | `click` on `<a target=_blank>` | Opens tab; user was warned in reason | 3.6 |
| 3.6-02 | P2 | React controlled input ignores synthetic events | Fallback: focus + `InputEvent` / native setter patterns | 3.6 |
| 3.6-03 | P1 | `type` clears user’s existing long form text wrongly | Document clear policy; prefer append for search boxes only | 3.6 |
| 3.6-04 | P2 | `select` option value not in list | Fail with error; agent replans | 3.6 |
| 3.6-05 | P1 | Execute while `mapVersion` stale | SW rejects execute; refresh map | 3.6, 3.8 |
| 3.6-06 | P2 | File input click cannot auto-upload path | Agent can click input; user must pick file manually—document | 3.6 |
| 3.6-07 | P1 | Double Approve double execution | Disable Approve while Executing | 3.6 |

### Slice 3.7 — Controls

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.7-01 | P1 | Dry-run on scroll action | Scroll still moves page—or define dry-run as no-op for scroll | 3.7 |
| 3.7-02 | P1 | Step limit reached mid-approval | Idle + message; clear pending | 3.7 |
| 3.7-03 | P2 | Max steps = 0 or absurdly high | Validate in settings | 3.7 |
| 3.7-04 | P1 | Stop during Executing | Best-effort halt; no second click | 3.7 |

### Slice 3.8 — Persistence

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.8-01 | P1 | Storage write fails during approval wait | Show warning; in-memory state still usable until panel closed | 3.8 |
| 3.8-02 | P2 | Restored session tab closed | Clear stale session or show “tab gone” | 3.8 |
| 3.8-03 | P2 | Two tabs same task keys collide | Session keyed by `tabId`; independent | 3.8 |
| 3.8-04 | P2 | Old schema in storage after update | Migration or reset agent session | 3.8 |
| 3.8-05 | P1 | User approves on restored stale proposal | Re-validate mapVersion and safety before execute | 3.8 |

### Slice 3.9 — Practice allowlist

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 3.9-01 | P0 | Agent runs on google.com | Block unless explicitly allowlisted | 3.9 |
| 3.9-02 | P2 | Subdomain not in list (`www.` vs bare) | Normalize origin comparison | 3.9 |
| 3.9-03 | P2 | Multi-page errand: navigation leaves allowlist | Stop agent on leave or block navigate step | 3.9 |
| 3.9-04 | P2 | `localhost` practice app different port | Each origin explicit in config | 3.9 |

---

## 5. Phase 4 — Memory, safety, shipping

### Slice 4.1 — Profile

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.1-01 | P0 | Profile injected into every chat automatically | Only on fill/draft/skill explicit | 4.1 |
| 4.1-02 | P2 | Unicode / emoji in name | Storage and prompts handle UTF-8 | 4.1 |
| 4.1-03 | P2 | Empty profile “fill form” skill | Prompt user to complete profile | 4.1 |
| 4.1-04 | P0 | Profile leaked to content script message | SW/panel only in prompts | 4.1 |

### Slice 4.2 — Skills

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.2-01 | P2 | Skill template missing variable | Leave empty or show `[missing selection]` | 4.2 |
| 4.2-02 | P1 | Skill name duplicate | Allow or dedupe by id | 4.2 |
| 4.2-03 | P2 | Very long prompt template | Truncate page variables, not template | 4.2 |
| 4.2-04 | P2 | Skill runs agent-like instructions | Still subject to agent allowlist if it triggers agent path | 4.2 |

### Slice 4.3 — Import / export

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.3-01 | P1 | Malformed JSON on import | Reject; no partial corrupt array | 4.3 |
| 4.3-02 | P1 | Import file with `version: 999` | Reject or migrate | 4.3 |
| 4.3-03 | P2 | Import merge vs replace UX unclear | Confirm dialog | 4.3 |
| 4.3-04 | P0 | Imported skill contains exfil instructions | User trust model; warn that skills run prompts they author | 4.3 README |

### Slice 4.4 — Safety hardening

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.4-01 | P0 | Login form: agent proposes type username | Allowed on practice site only; never password | 4.4 |
| 4.4-02 | P0 | “Send” email consequential confirm | Extra modal | 4.4 |
| 4.4-03 | P1 | Sensitive read (bank balance page) summarise | Warn before cloud send | 4.4 |
| 4.4-04 | P2 | URL blocklist bypass via IP literal | Best-effort; document | 4.4 |
| 4.4-05 | P1 | Kill switch during badge overlay | Remove overlay + end session | 4.4 |

### Slice 4.5 — Key hygiene

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.5-01 | P0 | Key in `dist` source map | Disable sources in release build or strip | 4.5 |
| 4.5-02 | P0 | Key logged in `console.log` debug | Remove debug logs in production | 4.5 |

### Slice 4.6 — Release

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.6-01 | P1 | Zip missing manifest or wrong paths | Checklist script before release | 4.6 |
| 4.6-02 | P2 | User loads old release cache | Version in manifest + README | 4.6 |
| 4.6-03 | P2 | Windows path case sensitivity | Build on CI Linux | 4.6 |

### Slice 4.7 — GitHub Pages

| ID | Sev | Scenario | Expected behavior | Slice |
|----|-----|----------|---------------------|-------|
| 4.7-01 | P3 | Pages base path breaks asset links | Use relative paths | 4.7 |
| 4.7-02 | P3 | Demo GIF huge | Compress in repo | 4.7 |

---

## 6. AI & model behavior (model-adjacent)

These are not bugs in Chrome but **product risks** when the model misbehaves. Code must stay authoritative.

| ID | Sev | Scenario | Expected behavior | Mitigation |
|----|-----|----------|---------------------|------------|
| M-01 | P1 | Hallucinated page facts in chat | Grounding prompt + “not on page” training in system prompt | 2.1 |
| M-02 | P0 | Model outputs executable JS/HTML in markdown | Sanitize panel render | 1.4+ |
| M-03 | P1 | Agent JSON wrapped in markdown fences | Strip fences before Zod | 3.4 |
| M-04 | P1 | Agent proposes two actions in one JSON | Schema allows one action only; reject | 3.4 |
| M-05 | P2 | Hinglish summary too informal / offensive | Tone line in prompt; user Stop | 1.8 |
| M-06 | P2 | Groq context smaller than Gemini | Truncate page text more aggressively on fallback | 2.5 |
| M-07 | P1 | Empty model response | Retry once; then error | 2.5 |

---

## 7. Security & privacy checklist (verification)

Use before release ( ties to problem statement DoD item 12 ):

- [ ] Password fields never receive agent `type` (manual + unit test)
- [ ] Banking/payment/UPI URLs block agent start and optionally warn on summarise
- [ ] OTP/card fields blocked in map and executor
- [ ] Consequential buttons require second confirm
- [ ] Stop works from all agent states
- [ ] No API keys in git, dist maps, or page context
- [ ] Content script bundle contains no keys, no `fetch` to LLM
- [ ] Model output never assigned to DOM on host page

---

## 8. Suggested test pages (manual matrix)

| Page type | Exercises |
|-----------|-----------|
| Long-form news article | 1.5, 1.6, 2.1 |
| Google search results | 1.5 negative |
| Public YouTube watch | 1.7 |
| MDN documentation | 1.5, 2.1 |
| Cohort practice form | 3.1–3.9 |
| Page with chart/image | 2.4 |
| `chrome://settings` | X-03, X-04 |
| Heavy SPA (Gmail-like) | 1.2 stale context, 3.1 map refresh |

---

## 9. Maintenance

| When | Action |
|------|--------|
| After each slice manual test | Add new rows with ID prefix of slice |
| After DoD audit (4.8) | Mark fixed items; link PR/commit in optional column |
| Before release | Re-run §7 checklist |

---

## References

- [implementation-plan.md](./implementation-plan.md) — slices and manual tests
- [architecture.md](./architecture.md) — trust boundary, FSM, safety pipeline
- [problem-statement.md](./problem-statement.md) — out of scope and DoD
