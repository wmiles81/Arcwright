# Spike: Zed ACP Web Browser / AI SDK Feasibility

**Date:** 2026-03-03  
**Branch:** `spike/zed-acp-web-browser`  
**Status:** Research  

---

## What Is ACP?

The **Agent Client Protocol** (ACP) is an open standard that lets code editors (like Zed) communicate with any ACP-compatible AI agent without building custom integrations for each one. Think of it as *LSP for AI agents*.

- **Local agents** run as sub-processes, communicating via **JSON-RPC over stdio**
- **Remote agents** communicate over **HTTP or WebSocket**
- Built on JSON-RPC and reuses **MCP types** where possible
- Designed for trusted local development environments (agent gets access to local files + MCP servers)

**Key links:**
- [ACP Spec](https://agentclientprotocol.com)
- [ACP Architecture](https://agentclientprotocol.com/get-started/architecture)
- [Zed External Agents Docs](https://zed.dev/docs/ai/external-agents)
- [ACP Registry](https://github.com/agentclientprotocol/registry)

---

## What Is the "Web Browser (AI SDK)" Client?

The `@mcpc/acp-ai-provider` npm package makes ACP available **inside a web browser** via Vercel's AI SDK. This means a web application could:

1. Connect to ACP-compatible agents (Gemini CLI, Claude Agent, Codex, etc.)
2. Provide a browser-based AI coding/editing UX
3. Delegate tool calls, file access, and MCP server management to the agent

**npm package:** `@mcpc/acp-ai-provider`  
**Docs:** [Zed ACP Web Browser page](https://zed.dev/acp/editor/web-browser)

---

## Relevance to Arcwright

Arcwright is a **React + Vite fiction-writing tool** with existing AI integrations (OpenRouter, OpenAI, Anthropic, Perplexity). Currently, each provider requires its own API key management and request formatting.

### What ACP Could Enable

| Capability | Current State | With ACP |
|---|---|---|
| **Provider flexibility** | 4 hardcoded providers | Any ACP-compatible agent, auto-updated via registry |
| **Agent capabilities** | Chat + analysis only | Full agent loop (tool use, file ops, multi-step reasoning) |
| **MCP server access** | None | Access MCP tools (Notion, databases, etc.) directly from the app |
| **Local file access** | Via browser file APIs | Agent manages files natively |
| **Protocol maintenance** | Custom per-provider | Single ACP integration |

### Potential Use Cases in Arcwright

1. **Agentic Editing Pipeline** — Instead of one-shot AI calls, use a full agent loop for chapter revision (read → analyze → propose edits → apply)
2. **MCP-powered Research** — During analysis, agents could pull context from Notion, web searches, or other MCP tools
3. **Custom Writing Agents** — Register a custom fiction-tuned agent via `agent_servers` config and use it alongside general-purpose agents
4. **Provider-Agnostic Architecture** — Replace the 4 separate provider integrations with a single ACP interface

---

## Feasibility Assessment

### ✅ Strong Fit

- Arcwright already has AI provider infrastructure — ACP would **consolidate and extend** it
- The `@mcpc/acp-ai-provider` package integrates with **Vercel's AI SDK**, which is well-documented and React-friendly
- ACP's design philosophy (JSON-RPC, MCP-compatible) aligns with Arcwright's local-first approach

### ⚠️ Considerations

- **ACP is still young** — the registry is curated and limited; the protocol may evolve
- **Web browser clients are a secondary use case** — ACP was designed primarily for code editors; some features may not translate cleanly to a fiction-writing app
- **Agent trust model** — ACP assumes a trusted local environment; running in a browser introduces different security considerations
- **Complexity** — full agent loops (tool calls, multi-step reasoning) add UX complexity compared to current one-shot API calls

### 🔴 Blockers / Unknowns

- Need to verify `@mcpc/acp-ai-provider` maturity (npm page returned 403, couldn't inspect package details)
- Unclear how agent file-access works in browser context vs. native editor
- No documentation found on authentication flow for web browser ACP clients

---

## Recommended Next Steps

1. **Install & inspect** `@mcpc/acp-ai-provider` locally to evaluate API surface and maturity
2. **Build a minimal PoC** — wire up ACP provider alongside existing providers in Arcwright's settings
3. **Test with Gemini CLI** (reference ACP implementation) to validate the round-trip
4. **Evaluate UX** — determine if the agent loop model works for fiction editing or if one-shot calls remain preferable for some workflows
