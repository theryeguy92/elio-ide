<div align="center">

<img src="frontend/public/elio-logo.png" alt="elio-ide logo" width="80" />

# elio-ide

*A browser-based IDE built for writing, running, and debugging AI agents.*

[![License](https://img.shields.io/badge/license-MIT-F5A623?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Ollama](https://img.shields.io/badge/Works%20with-Ollama-white?style=flat-square)](https://ollama.com)
[![Platform](https://img.shields.io/badge/platform-WSL%20%7C%20Linux%20%7C%20macOS-888888?style=flat-square)](https://github.com/leveyrl/elio-ide)

</div>

---

<!-- screenshot -->
> **Screenshot coming soon**
<!-- /screenshot -->

---

## What is elio-ide?

Most IDEs treat AI agents like regular code. They aren't. Agents loop, branch, call tools, read and write memory, and hand off between each other in ways that are completely invisible in a standard editor. elio-ide is built around the **run trace** — every LLM call, tool invocation, memory operation, and agent handoff is captured in real time and made navigable. The trace is the primary interface, not an afterthought.

---

## Features

### ⚡ Editor
| | |
|---|---|
| Monaco editor (VS Code engine) | Full syntax highlighting, multi-tab, language detection |
| Real file system | Sidebar reads actual project files via `/fs/tree` |
| Save & edit | Ctrl+S writes to disk, unsaved indicator on tab |
| Trace-to-code jump | Click a trace step → Monaco scrolls to the exact source line |

### 🔍 Trace Engine
| | |
|---|---|
| Live WebSocket streaming | Steps appear in real time as the agent runs |
| Step inspector | Full input, output, latency, and token count per step |
| Source linking | Every step captures its call site file and line number |
| Run history | All runs stored and browsable |

### 🖥️ GPU Compute
| | |
|---|---|
| Ollama integration | Detect local models, select active model |
| GPU info | VRAM usage and utilization from `nvidia-smi` |
| Cloud keys | RunPod, Lambda Labs, OpenAI, Anthropic — configured in one panel |
| RunPod sessions | One-click GPU launch, live cost tracking |

### 🗺️ Stakeholder View
| | |
|---|---|
| Auto-generated diagram | Agent, tool, and memory nodes built from actual run traces |
| Live edge animation | Edges pulse amber during active runs |
| Health indicators | Green / yellow / red per node from step success rates |
| PNG export | Share architecture diagrams in meetings or docs |

### 🌿 Git Integration
| | |
|---|---|
| Stage, commit, push | Without leaving the IDE |
| Branch switcher | Dropdown in toolbar, live branch indicator |
| AI commit messages | Suggested from staged diff via Claude |

---

## Quick Start

**Prerequisites:** Node.js 18+, Python 3.10+, [Ollama](https://ollama.com) (optional for local models)

**1. Clone**

```bash
git clone https://github.com/leveyrl/elio-ide.git
cd elio-ide
```

**2. Install dependencies**

```bash
cd frontend && npm install
cd ../backend && pip install -r requirements.txt
```

**3. Configure**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GIT_REPO_PATH=/path/to/your/agent/project

# Optional — leave blank to use local SQLite storage
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Optional — enables cloud model listing and AI features
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
RUNPOD_API_KEY=
```

**4. Run**

```bash
# Terminal 1
cd frontend && npm run dev

# Terminal 2
cd backend && uvicorn main:app --reload
```

**5. Open** → [http://localhost:3000](http://localhost:3000)

---

## How It Works

```
Write agent code in Monaco editor
          │
          ▼
    Press Run (F5)
          │
          ▼
  Backend executes file in subprocess
  Trace client captures every step via WebSocket
          │
          ▼
  Trace timeline updates live in the right panel
  Each step shows type, latency, tokens, source line
          │
          ▼
  Click any step → Monaco jumps to the source line
  Click step again → inspector shows full I/O
          │
          ▼
  Stakeholder tab builds architecture diagram from run
  Nodes and edges inferred from actual behavior
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Graph rendering | React Flow |
| Backend | FastAPI, Python 3.10+ |
| Trace streaming | WebSocket + `asyncio.Queue` |
| Storage | SQLite (default) or Supabase (Postgres + Realtime) |
| Local inference | Ollama via REST API |
| GPU provisioning | RunPod API |
| AI features | Anthropic Claude API |
| Git operations | GitPython |

---

## Roadmap

- [x] Monaco editor with multi-tab and real file loading
- [x] Live trace timeline via WebSocket
- [x] Trace-to-code jump (click step → jump to source line)
- [x] Stakeholder architecture diagram from run traces
- [x] Git panel — stage, commit, push, branch switch
- [x] Compute settings panel — Ollama, GPU info, API keys
- [x] Run button with subprocess execution and ANSI terminal output
- [ ] Step-through debugger — pause agent between reasoning steps
- [ ] Run comparison — diff two runs side by side
- [ ] Lambda Labs GPU provider
- [ ] Multi-agent orchestration canvas
- [ ] Team workspaces and shared trace history
- [ ] Hosted cloud version

---

## Contributing

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach. The backend follows FastAPI conventions with Pydantic models and async routers. The frontend uses React context for shared state — `EditorContext`, `RunContext`, and `CodeJumpContext` are the three main wires to understand before touching UI code. There are no tests yet; correctness is currently validated manually.

---

## License

MIT © 2025 Ryan Levey
