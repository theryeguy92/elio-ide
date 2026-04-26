# elio-ide

A browser-based IDE built specifically for agentic AI development. Write agents, run them on rented GPU, watch every decision stream live, and share a self-updating architecture diagram with your team — all without leaving the browser.

---

## Why elio-ide

Most IDEs treat AI agents like regular code. They aren't. Agents loop, branch, call tools, read and write memory, and hand off between each other in ways that are invisible in a standard editor.

elio-ide is built around the **run trace** — every LLM call, tool invocation, memory operation, and agent handoff is captured and made navigable. The trace is the primary interface, not an afterthought.

---

## Features

### Monaco Editor
- Browser-based code editor (same engine as VS Code)
- Native support for LangChain, CrewAI, AutoGen, LlamaIndex
- Agentic pattern completions (tool definitions, memory calls, agent handoffs)

### Trace Engine
- Every agent run is fully captured in real time via WebSocket
- Scrollable trace timeline with step-by-step breakdown
- Step inspector — full input, output, latency, and token count per step
- Click any step to inspect it; full run history stored and searchable

### GPU Compute Layer
- One-click GPU session launch via RunPod
- Live cost counter with smooth interpolation
- Session state machine: idle → launching → running → terminating
- Budget caps and real-time spend tracking

### Stakeholder Tab
- Auto-generated architecture diagram built from run traces
- Agent, tool, and memory nodes inferred from actual run behavior — not declared manually
- Claude-generated plain English descriptions per node
- Animated edges during live runs
- PNG export for sharing in meetings or docs
- Green / yellow / red health indicators per node based on step success rates

### Git Integration
- Stage, commit, push, and branch switch without leaving the IDE
- AI-suggested commit messages based on staged diff
- Recent commit history in the sidebar
- Live branch indicator in the toolbar

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Editor | Monaco Editor |
| Diagrams | React Flow |
| Backend | FastAPI (Python) |
| Trace streaming | WebSocket + asyncio.Queue |
| Database | Supabase (Postgres + Realtime) |
| Auth | Supabase Auth |
| GPU provider | RunPod |
| AI descriptions | Anthropic Claude API |
| Git operations | GitPython |

---

## Project Structure

```
elio-ide/
├── frontend/
│   ├── app/
│   ├── components/
│   │   ├── editor/        # Monaco editor
│   │   ├── trace/         # Trace timeline, step inspector
│   │   ├── gpu/           # GPU launcher and session management
│   │   ├── stakeholder/   # Architecture diagram
│   │   ├── git/           # Git panel
│   │   └── layout/        # Toolbar, sidebar, tab bar
│   ├── lib/               # API wrappers, Supabase client
│   └── hooks/
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── trace.py
│   │   ├── gpu.py
│   │   ├── stakeholder.py
│   │   └── git.py
│   ├── models/
│   └── migrations/
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Python 3.10+
- A Supabase project
- A RunPod account and API key
- An Anthropic API key (for stakeholder descriptions and commit suggestions)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/elio-ide.git
cd elio-ide
```

### 2. Set up the database

Run the migration in your Supabase SQL editor:

```bash
# Copy contents of this file into Supabase SQL editor and run
backend/migrations/001_traces.sql
```

### 3. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
RUNPOD_API_KEY=
ANTHROPIC_API_KEY=
GIT_REPO_PATH=/path/to/your/agent/project
```

```bash
# Frontend
cp frontend/.env.local.example frontend/.env.local
```

Fill in `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && pip install -r requirements.txt
```

### 5. Run the app

```bash
# Terminal 1 — Frontend
cd frontend && npm run dev

# Terminal 2 — Backend
cd backend && uvicorn main:app --reload
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

```
Write agent code in Monaco
        ↓
Launch a GPU session (one click via RunPod)
        ↓
Run your agent — trace captures every step live
        ↓
Inspect the trace timeline — click any step to see full I/O
        ↓
Open Stakeholder Tab — architecture diagram builds from traces
        ↓
AI suggests a commit message — push to Git without leaving the IDE
```

---

## Roadmap

- [ ] Step-through agent debugger (pause between reasoning steps)
- [ ] Trace-to-code linking (click a trace step → jump to the exact line)
- [ ] Run comparison — diff two runs side by side
- [ ] Lambda Labs as a second GPU provider
- [ ] Multi-agent orchestration canvas
- [ ] Team workspaces and shared trace history

---

## Contributing

PRs welcome. Open an issue first for anything significant.

---

## License

MIT
