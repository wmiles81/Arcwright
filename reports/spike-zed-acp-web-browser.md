# Spike: Zed ACP Web Browser / AI SDK Feasibility

**Date:** 2026-03-03  
**Branch:** `spike/zed-acp-web-browser`  
**Status:** Step 1 Complete — Package Inspection  

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
2. **Decide on architecture** — Is adding a server layer acceptable for Arcwright?
3. **Build a minimal PoC** — Add a `/api/acp` endpoint to `server.js` that spawns a Gemini CLI agent and streams responses
4. **Test with Gemini CLI** (reference ACP implementation) to validate the round-trip
5. **Evaluate UX** — determine if the agent loop model works for fiction editing
