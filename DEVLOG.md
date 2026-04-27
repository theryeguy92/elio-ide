# Elio IDE — Dev Log
**Date:** 2026-04-26 (test)

---

## What This Project Is

Elio IDE is a browser-based development environment purpose-built for AI agent work. The core premise is that agentic code is fundamentally different from regular code — agents loop, branch, call tools, and hand off between each other in ways that are invisible in a standard editor. So the primary interface here isn't the file tree or the editor; it's the **run trace**. Every LLM call, tool invocation, memory operation, and agent handoff is captured in real time and made navigable. Layered on top: one-click GPU rentals via RunPod, a self-updating architecture diagram that builds itself from trace data, and a Git panel with AI-suggested commit messages — all without leaving the browser.

---

## What Was Built Today

### Phase 1 — IDE Shell
The outer chrome: `TopToolbar`, `Sidebar`, `BottomTabBar`, and the Monaco Editor wrapper. Monaco is configured for Python with ligature fonts, no minimap, and a dark VS Code theme. The toolbar includes a live branch switcher that calls the Git API and a "Run Agent" button placeholder. Nothing exotic here — the goal was to get a credible IDE frame on screen fast.

### Phase 2 — Trace Engine (backend)
The most important part of the system. Built a REST + WebSocket API in FastAPI:

- `POST /traces/runs` — creates a run record
- `POST /traces/runs/{id}/steps` — appends a step and broadcasts it live
- `PATCH` endpoints for updating run/step status as work completes
- `GET /traces/runs/{id}` — fetches a full run with all steps (used on initial load)
- `WebSocket /traces/runs/{id}/live` — streams new and updated steps in real time

The WebSocket implementation uses an in-process `asyncio.Queue` per subscriber (`_live` dict). When a step is created or updated, `_broadcast` puts the payload onto every queue for that run. The WS handler pulls from the queue and sends, with a 25-second timeout that sends a `__ping__` frame to keep connections alive through load balancers and proxies.

Step types modeled: `llm_call`, `tool_call`, `agent_handoff`, `memory_read`, `memory_write`.

### Phase 3 — Storage Abstraction Layer
The backend needed to work locally without Supabase credentials. Built a clean `StorageBackend` ABC with two implementations:

- **`SQLiteStorage`** — aiosqlite, auto-creates schema on first connect, stores JSON-serialized input/output in TEXT columns. Default for local dev.
- **`SupabaseStorage`** — wraps the sync supabase-py client with `asyncio.to_thread`. Used when `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are both set.

`main.py` inspects env vars at startup and wires the correct backend through a `deps.py` singleton. The rest of the codebase only ever sees `StorageBackend` — swapping between local and production requires zero code changes.

### Phase 4 — Trace Frontend
Three components that compose into the right sidebar:

- **`RunList`** — lists runs with status dots (animated ping for live runs), relative timestamps, token and cost totals. Polls every 10 seconds when idle.
- **`StepView`** — loads a run's steps, then opens a WebSocket for live updates while the run is active. Steps are **upserted** by ID so status transitions (running → completed) update in place rather than duplicating. Auto-scrolls to the newest step. Shows a `Wifi`/`WifiOff` icon to indicate WebSocket connection state.
- **`StepInspector`** — slide-up panel showing full input/output JSON, latency, and token count for a selected step. Renders plain strings as `<pre>` and objects as pretty-printed JSON.
- **`stepMeta.ts`** — lookup table mapping step types to icon + color, keeping the visual logic out of the rendering components.

### Phase 5 — GPU Compute Layer
`GPULauncher` on the frontend, `routers/gpu.py` on the backend. The backend proxies RunPod's GraphQL API for three operations: list available GPU types, launch a pod, get pod status, and terminate.

The frontend state machine has five states: `idle → launching → running → terminating → error`. The live cost display uses two intervals: a 5-second poll that fetches real uptime and accrued cost from RunPod, and a 100ms tick that interpolates cost between polls using `cost_per_hr` and elapsed time since the last poll. This gives a smooth, continuously updating dollar counter without hammering the API.

Both the backend and frontend gracefully degrade when no RunPod API key is configured — the backend returns a `{"mode": "local"}` sentinel and the frontend handles it silently.

### Phase 6 — Stakeholder Architecture Diagram
`StakeholderTab` renders a React Flow canvas. The backend (`routers/stakeholder.py`) infers the graph by replaying trace data — it doesn't require any manual node declarations:

- Each unique run name becomes an **Agent** node
- `tool_call` steps become **Tool** nodes, edges labeled "calls"
- `memory_read`/`memory_write` steps become **Memory** nodes, edges labeled "reads from" / "writes to"
- `agent_handoff` steps create edges between Agent nodes

Health status per node is computed as `green` (≥90% success), `yellow` (≥70%), or `red` (<70%).

Clicking a node triggers `POST /stakeholder/describe`, which calls Claude (`claude-sonnet-4-6`) to generate a 2-sentence plain-English description for a non-technical audience. If no Anthropic key is set, a rule-based fallback generates something reasonable from the raw stats.

The frontend layout is a three-row tier: agents on top, tools in the middle, memory at the bottom. Edges animate when a live run is detected. PNG export uses `html-to-image` with a 2× pixel ratio, stripping the React Flow controls from the output.

### Phase 7 — Git Integration
`routers/git.py` wraps GitPython. All operations run in `asyncio.to_thread` since GitPython is synchronous. Endpoints: `GET /git/status`, `GET /git/log`, `POST /git/stage`, `POST /git/unstage`, `POST /git/commit`, `POST /git/push`, `GET /git/branches`, `POST /git/branches`, `POST /git/checkout`, `POST /git/suggest-message`.

`suggest-message` sends the staged diff (or unstaged diff as fallback) to Claude with an imperative-mood prompt and returns a single line ≤72 chars.

The frontend `GitPanel` is a collapsible section in the sidebar. Files show their git status letter (M/A/D/R/U) with color coding. Checkboxes toggle staging. The commit message field has a sparkle button to trigger AI suggestion. Commit and push are separate actions.

`TopToolbar` shows the current branch with a dropdown that calls `POST /git/checkout` on selection.

### Phase 8 — Test Agents
Two LangChain ReAct agents in `test-agent/` for exercising the trace system end-to-end, both using `gemma3:12b` via Ollama:

- **`research_agent.py`** — single-tool agent with a mock `search_web` tool. Straightforward, used to validate the basic LLM call → tool call → LLM call loop in the trace UI.
- **`calculator_agent.py`** — two-tool agent (`calculate` using safe AST eval, `convert_units` with a unit lookup table). More complex traces with interleaved step types.

**`trace_client.py`** is a LangChain `BaseCallbackHandler` that hooks into the agent executor lifecycle and POSTs/PATCHes to the trace API. It maps LangChain's run IDs to backend step IDs, tracks monotonic start times for latency calculation, and handles the root chain / nested chain distinction so only one backend run is created per agent execution. Both `on_chain_end` and `on_agent_finish` can close the run to handle edge cases in the LangChain callback lifecycle.

---

## Key Technical Decisions

**Storage as an abstract interface, not a direct dependency.** Any router that needs persistence receives a `StorageBackend` via FastAPI's `Depends`. This let us build and test the entire system locally with SQLite before Supabase was configured, and it keeps the option open to add other backends later without touching router code.

**WebSocket pub/sub via in-process queues, not Redis or SSE.** For a single-server dev tool, `asyncio.Queue` per subscriber is zero-dependency and plenty. The 25-second ping prevents transparent proxies from killing quiet connections. If this ever needs to scale horizontally, swapping the `_live` dict for a Redis pub/sub would be isolated to about 20 lines in `routers/trace.py`.

**Graph inferred from traces, not declared.** The stakeholder diagram builds itself from what agents actually do — no YAML manifest, no decorator magic. This means it stays accurate automatically and works with any LangChain-based agent without modification.

**Claude for descriptions, rule-based fallback.** The stakeholder node descriptions feel polished with Claude but the system doesn't break without an API key. The fallback generates grammatically correct sentences from the raw stats. The Claude prompt explicitly asks for non-technical language ("no mention of APIs/JSON/tokens/code") — the descriptions are for stakeholders, not developers.

**Single-string tool signatures for local LLMs.** ReAct agents backed by local models (Gemma, Llama) frequently serialize multi-argument tool calls as a single comma-separated string rather than structured JSON. Converting `convert_units(value, from_unit, to_unit)` to `convert_units(query: str)` with internal parsing makes the tool robust to this, at the cost of slightly looser typing. Worth the tradeoff for local LLM compatibility.

---

## Problems We Hit

**Gemma serializes multi-param tool calls as a single string.** Gemma 3 would produce `Action Input: 187.5, "mi", "km"` when calling `convert_units`, which LangChain passed as-is to the first parameter (`value`), causing a type error. Fixed by collapsing the three parameters into a single `query: str` with internal `split(',')` and `strip('"')` parsing. The same pattern should be applied to any future multi-argument tools.

**SQLite async with aiosqlite + sqlite3.Row.** `aiosqlite` doesn't automatically use `sqlite3.Row` as the row factory — you have to set it after opening the connection. Without it, rows come back as tuples and `.keys()` isn't available for the dict conversion. Also, `input` and `output` are stored as JSON text in SQLite; the `_to_dict` helper deserializes them on read so the rest of the code always sees Python objects.

**StepView receiving duplicate steps on status updates.** The WebSocket broadcasts both new steps and updates to existing ones (e.g., a step transitioning from `running` to `completed`). The frontend was initially appending all incoming payloads, causing duplicate rows. Fixed with an upsert pattern: find by ID in the existing array and replace if found, otherwise append.

**React Flow `nodeTypes` causing remounts.** Defining the `nodeTypes` object inside the component caused React Flow to treat them as new types on every render, remounting all nodes. Moved the definition outside the component to a module-level constant.

**RunPod accrued cost only updates on poll.** With a 5-second poll interval, the cost counter would jump in discrete increments. Fixed with the 100ms tick interval that interpolates from `accrued_cost` at the last poll time using `cost_per_hr` and elapsed wall time, so the counter ticks smoothly.

---

## Current State — What Works Right Now

- Full IDE shell renders at `localhost:3000` with Monaco editor, toolbar, and sidebar
- Backend starts at `localhost:8000` with auto-selected storage (SQLite locally, Supabase in production)
- Trace API is complete: create runs, append steps, update status, fetch history, stream live via WebSocket
- Trace timeline shows all past runs, click into any run to see step-by-step breakdown with input/output inspection
- Live WS streaming works during active runs — steps appear in real time, status updates in place
- GPU launcher shows available RunPod instances (or degrades gracefully with no API key)
- Cost counter ticks smoothly while a session is running
- Stakeholder diagram renders from trace data, nodes auto-populate after first agent run
- Click any node to get a Claude-generated plain-English description and recent activity
- Git panel stages/unstages files, commits, pushes, and switches branches without leaving the IDE
- AI commit message suggestion works off staged or unstaged diff
- Two test agents (`research_agent.py`, `calculator_agent.py`) run end-to-end and populate the trace UI via `ElioTracer`

---

## What Comes Next

- **"Run Agent" button wires up.** The toolbar button currently does nothing. Next step is to execute the agent script that's open in the editor, piping stdout into a terminal panel and feeding trace events into the UI in real time.
- **Terminal / output panel.** Needs a bottom panel that shows agent stdout alongside the trace — the trace gives structure, the terminal gives the raw output.
- **Trace-to-code linking.** Click a `tool_call` step → jump to the tool definition in the editor. Requires parsing the agent file to map tool names to line numbers.
- **Step-through debugger.** Pause execution between ReAct reasoning steps, inspect state, resume. This is the hardest piece — needs a way to inject a pause into the agent loop, probably via a custom callback that blocks on an asyncio event.
- **Run comparison.** Diff two runs side by side. Useful for prompt iteration — same agent, different prompt, see what changed in the trace.
- **Lambda Labs as a second GPU provider.** The GPU router already has a clean abstraction (`gql` helper, `SessionResponse` model); adding a second provider is additive.
- **Supabase Realtime for the trace.** The current WebSocket implementation is per-server. For multi-tab or multi-user scenarios, replacing `_live` with Supabase Realtime subscriptions would be the right move.
- **Auth.** Supabase Auth is in the stack but not wired yet. All endpoints are currently unauthenticated.
