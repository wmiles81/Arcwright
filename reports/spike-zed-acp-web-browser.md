# Spike: Zed ACP Web Browser / AI SDK Feasibility

**Date:** 2026-03-03  
**Branch:** `spike/zed-acp-web-browser`  
**Status:** PoC Complete — Platform Awareness Paths Documented  

---

## What Is ACP?

The **Agent Client Protocol** (ACP) is an open standard that lets code editors (like Zed) communicate with any ACP-compatible AI agent without building custom integrations for each one. Think of it as *LSP for AI agents*.

- **Local agents** run as sub-processes, communicating via **JSON-RPC over stdio**
- **Remote agents** communicate over **HTTP or WebSocket**
- Built on JSON-RPC and reuses **MCP types** where possible
- Designed for trusted local development environments (agent gets access to local files + MCP servers)
- Official SDKs available in **TypeScript, Python, Rust, Kotlin**

**Key links:**
- [ACP Spec](https://agentclientprotocol.com)
- [ACP Architecture](https://agentclientprotocol.com/get-started/architecture)
- [Zed External Agents Docs](https://zed.dev/docs/ai/external-agents)
- [ACP Registry](https://github.com/agentclientprotocol/registry)
- [ACP GitHub Monorepo](https://github.com/agentclientprotocol/agent-client-protocol)

---

## What Is the "Web Browser (AI SDK)" Client?

The `@mcpc-tech/acp-ai-provider` npm package makes ACP available via **Vercel's AI SDK**. This means an application could:

1. Connect to ACP-compatible agents (Gemini CLI, Claude Agent, Codex, etc.)
2. Provide an AI-assisted editing UX through a unified protocol
3. Delegate tool calls, file access, and MCP server management to the agent

> ⚠️ **Note:** Zed's docs list the package as `@mcpc/acp-ai-provider` but the actual npm package is `@mcpc-tech/acp-ai-provider`. The JSR (Deno) scope is `@mcpc/acp-ai-provider`.

**npm:** `@mcpc-tech/acp-ai-provider`  
**JSR:** `@mcpc/acp-ai-provider`  
**Source:** [github.com/mcpc-tech/mcpc](https://github.com/mcpc-tech/mcpc)

---

## Step 1 Findings: Package Inspection

### Package Metadata

| Field | Value |
|---|---|
| **Version** | `0.2.5` |
| **License** | MIT |
| **AI SDK Version** | v6 (`ai` ^6.0.0) — v5 supported via `@0.1.x` |
| **ACP SDK** | `@agentclientprotocol/sdk` ^0.14.1 |
| **MCP SDK** | `@modelcontextprotocol/sdk` ^1.8.0 |
| **Dependencies installed** | 376 packages |
| **Vulnerabilities** | 3 (2 moderate, 1 high) |

### Exported API Surface

```typescript
// Core factory
export function createACPProvider(config: ACPProviderSettings): ACPProvider;

// Provider class
export class ACPProvider {
  languageModel(modelId?: string, modeId?: string): ACPLanguageModel;  // LanguageModelV2
  call(): ACPLanguageModel;
  get tools(): Record<string, ReturnType<typeof tool>> | undefined;
  getSessionId(): string | null;
  initSession(tools?): Promise<NewSessionResponse>;
  connect(): Promise<void>;
  setMode(modeId: string): Promise<void>;
  setModel(modelId: string): Promise<void>;
  cleanup(): void;
}

// Configuration
export interface ACPProviderSettings {
  command: string;            // Agent command (e.g., "gemini", "claude-agent-acp")
  args?: string[];            // Command arguments
  env?: Record<string, string>;
  session: ACPSessionConfig;  // cwd + mcpServers
  authMethodId?: string;
  existingSessionId?: string;
  persistSession?: boolean;
  sessionDelayMs?: number;
}

// Host-side tools
export function acpTools(tools): Record<string, ReturnType<typeof tool>>;
```

### How It Works

1. **Provider spawns an ACP agent as a child process** (e.g., `gemini --experimental-acp`)
2. Communication happens via **JSON-RPC over stdio**
3. The agent is exposed as a `LanguageModelV2` — compatible with `generateText()` and `streamText()`
4. **Session persistence** keeps conversation state between calls
5. **MCP servers** are passed to the agent at session creation (not managed by the app)
6. **Host-side tools** use a TCP socket callback pattern for bidirectional tool calling

### Key Capabilities

- ✅ **Streaming** via AI SDK's `streamText` + `fullStream`
- ✅ **Session persistence** across multiple requests (`persistSession: true`)
- ✅ **Multi-session management** for server/API patterns (session map)
- ✅ **Model & mode selection** (e.g., Claude's "opus"/"haiku", modes like "plan"/"ask")
- ✅ **MCP server integration** at session level
- ✅ **Raw stream parts** for plans, diffs, and terminal output
- ✅ **Pre-initialization** reduces TTFT from ~7.3s to ~2.8s

### Known Limitations

- ❌ **No token counting** — always returns 0
- ⚠️ **Dynamic host-side tools are experimental** (TCP callback adds complexity)
- ⚠️ **Child process model** — agents are spawned via `command`, meaning this is a **server-side / Node.js requirement**, not something that runs in the browser alone

---

## Critical Finding: Architecture Constraint

The package **spawns agents as child processes** via `command` + `args`. This means:

- **A Node.js backend is required** — the provider cannot run purely in the browser
- Arcwright currently runs 100% client-side (AI calls go directly from browser → provider APIs)
- Adding ACP would require Arcwright to either:
  1. **Add a Node.js server layer** (e.g., leverage the existing `server.js` or add API routes) that spawns and manages ACP agents
  2. **Use a hybrid architecture** where the Vite dev server / production server handles ACP, and the React frontend communicates via API

This is the same pattern Zed uses — the editor (client) spawns agents locally and manages communication. A web app would need a server to take the editor's role.

---

## Relevance to Arcwright

### What ACP Could Enable

| Capability | Current State | With ACP |
|---|---|---|
| **Provider flexibility** | 4 hardcoded providers | Any ACP-compatible agent |
| **Agent capabilities** | One-shot chat + analysis | Full agent loop (tool use, multi-step reasoning) |
| **MCP server access** | None | Notion, filesystem, web search, etc. |
| **Session memory** | None between calls | Persistent sessions with `persistSession` |
| **Protocol maintenance** | Custom per-provider | Single ACP integration |

### Potential Use Cases

1. **Agentic Editing Pipeline** — Multi-step chapter revision (read → analyze → propose edits → apply)
2. **MCP-powered Research** — Pull context from Notion, web searches during analysis
3. **Custom Writing Agents** — Use fiction-tuned agents alongside general-purpose ones
4. **Provider-Agnostic Architecture** — Single interface for all agents

---

## Updated Feasibility Assessment

### ✅ Viable With Architecture Change

- Package is **well-structured and documented** (v0.2.5, active development)
- API is clean — `createACPProvider()` → `provider.languageModel()` → `generateText()`/`streamText()`
- AI SDK v6 compatibility means modern React patterns work
- Session persistence is exactly what Arcwright needs for multi-step editing

### ⚠️ Requires Server Component

- **Biggest change:** Arcwright would need a Node.js server to spawn/manage ACP agents
- The existing `server.js` could be extended for this purpose
- This shifts Arcwright from pure client-side to a thin client + server architecture

### ⚠️ Maturity Concerns

- 3 npm vulnerabilities in dependency tree
- v0.2.x — still pre-1.0, API may change
- Token counting not supported (impacts usage tracking)

### 🔴 Blockers to Resolve

- Does Arcwright want to adopt a server-side component?
- Which ACP agents are actually available to test with? (Gemini CLI requires `--experimental-acp`)
- AI SDK v6 is a major version — need to verify compatibility with existing Arcwright dependencies

---

## Recommended Next Steps

1. ~~**Install & inspect** `@mcpc-tech/acp-ai-provider`~~ ✅ Done
2. ~~**Decide on architecture** — Is adding a server layer acceptable?~~ ✅ Done — server.js extended
3. ~~**Build a minimal PoC**~~ ✅ Done — ACP endpoint, provider, streaming all working
4. ~~**Test with agent**~~ ✅ Done — Claude Code via `@zed-industries/claude-code-acp`
5. **Evaluate UX** — see findings below

---

## PoC Results (2026-03-03)

### What Was Built

- `POST /api/acp/chat` endpoint in `server.js` (SSE streaming)
- ACP provider in frontend registry (`providers.js`)
- `callACPStreaming()` SSE reader in `providerAdapter.js`
- Vite dev proxy for `/api/acp` → `localhost:3000`
- Used `@zed-industries/claude-code-acp` adapter to connect Claude Code

### Outcome

**Round-trip works.** Claude Code responds to prompts through Arcwright's chat UI via ACP. However, the agent has **no awareness of Arcwright's platform** — it operates as a generic Claude session with no context about the user's project, editor state, or available tools.

---

## Key Finding: Platform Awareness Gap

The ACP agent runs as an isolated process. It doesn't know:
- What Arcwright is (fiction planning/editing tool)
- The user's open project (story arcs, chapters, characters)
- The editor state (active file, cursor position)
- Arcwright's built-in tools (scaffolding, analysis, inline edits)

### Three Paths to Platform Awareness

#### Path 1 — System Prompt Injection (Low effort)

Pass Arcwright's existing system prompt (from `buildChatSystemPrompt()`) into the ACP request body. The agent would understand the platform conceptually and could give fiction-aware responses, but cannot *act* on the platform.

**Effort:** ~1 hour. Modify `callACPStreaming()` to include system prompt in the messages array.

**Gain:** Contextual replies. Agent knows it's helping with fiction editing.

**Limit:** Read-only awareness. No ability to read files, run analysis, or modify content.

#### Path 2 — MCP Server Exposure (Medium effort)

ACP supports passing MCP server configs in the `session` object at provider creation. Build a lightweight MCP server that exposes Arcwright project data:

- `project://files` — list project files
- `project://chapter/{id}` — read chapter content
- `project://analysis/{id}` — read analysis results
- `project://outline` — story structure / beat sheets

The agent could then *read* project data during its reasoning.

**Effort:** 1–2 weeks. Requires building an MCP server, defining the resource schema, and wiring it into the ACP session config.

**Gain:** Agent can read and query project data. Enables context-aware analysis and suggestions.

**Limit:** Still read-only by default. Agent can reference content but not modify it without tool bridging (Path 3).

#### Path 3 — Tool Bridging (High effort)

Expose Arcwright's action handlers as ACP tools using the `acpTools()` function from the SDK. The agent could then:

- Read and write project files
- Run analysis workflows
- Apply inline edits
- Execute scaffolding operations

This is the "full agent" vision — the ACP agent becomes a peer to Arcwright's built-in AI, with the same capabilities but running in its own reasoning loop.

**Effort:** 3–4 weeks. Requires mapping Arcwright's `ACTION_HANDLERS` to ACP tool definitions, handling the TCP callback pattern for host-side tools, and building safety guardrails.

**Gain:** Full agent capabilities. Multi-step editing pipelines, autonomous analysis, etc.

**Limit:** Complexity. Host-side tools use a TCP socket callback pattern that adds architectural overhead. Safety and permission concerns increase significantly.

### Recommendation

Start with **Path 1** to validate the UX of a context-aware ACP agent in Arcwright. If it proves valuable, pursue **Path 2** to give the agent read access to project data. Path 3 should only be considered after Paths 1 and 2 have been evaluated.
