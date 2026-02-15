# OpenClaw Gateway WebSocket API Reference

**For PWA Testing — Quick Reference Card**

---

## Connection

```
ws://{host}:{port}?token={authToken}
```

**Default local:** `ws://localhost:11112`

**Your current Gateway (Jet):**
- URL: `ws://192.168.1.19:11112`
- Token: `Yh3uR2p6Q9vM7tC1nX8aL4eS5kJ0wB2fG6zH9dP3`
- Full URL: `ws://192.168.1.19:11112?token=Yh3uR2p6Q9vM7tC1nX8aL4eS5kJ0wB2fG6zH9dP3`

---

## Protocol Overview

### Message Format
All messages are **JSON over binary WebSocket frames**.

### Message Types

| Type | Direction | Structure |
|------|-----------|-----------|
| `hello` | Client → Server | `{ "event": "hello", "payload": { "version": "1.0" } }` |
| `helloOk` | Server → Client | `{ "event": "helloOk", "payload": { "ready": true } }` |
| **RPC Request** | Client → Server | `{ "id": "uuid", "method": "method.name", "params": {} }` |
| **RPC Response** | Server → Client | `{ "id": "uuid", "result": {}, "error": null }` |
| **Server Push** | Server → Client | `{ "event": "chat.chunk", "payload": {}, "seq": 123 }` |

---

## RPC Methods

### `chat.send` — Send a message

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "chat.send",
  "params": {
    "sessionKey": "main:abc123...",
    "message": "Hello, how are you?",
    "thinking": "off",
    "deliver": true,
    "timeoutMs": 30000
  }
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "runId": "run-xyz789..."
  },
  "error": null
}
```

---

### `chat.abort` — Cancel generation

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "chat.abort",
  "params": {
    "sessionKey": "main:abc123...",
    "runId": "run-xyz789..."
  }
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "ok": true,
    "aborted": true
  },
  "error": null
}
```

---

### `chat.history` — Get message history

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "chat.history",
  "params": {
    "sessionKey": "main:abc123...",
    "limit": 50
  }
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "messages": [
      { "role": "user", "content": "Hello" },
      { "role": "assistant", "content": "Hi there!" }
    ]
  },
  "error": null
}
```

---

### `models.list` — List available models

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "models.list",
  "params": {}
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "models": [
      {
        "id": "ollama/kimi-k2.5:cloud",
        "name": "kimi-k2.5",
        "provider": "ollama",
        "contextWindow": 131072,
        "reasoning": false
      },
      {
        "id": "github-copilot/gpt-5.2-codex",
        "name": "GPT-5.2 Codex",
        "provider": "github-copilot",
        "contextWindow": 200000,
        "reasoning": true
      }
    ]
  },
  "error": null
}
```

---

### `sessions.list` — List recent sessions

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "sessions.list",
  "params": {
    "limit": 10,
    "activeMinutes": 60,
    "includeGlobal": false,
    "agentId": "main"
  }
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "sessions": [
      {
        "key": "main:abc123...",
        "displayName": "Main Session",
        "derivedTitle": "Code Review Discussion",
        "updatedAt": "2026-02-15T07:20:00Z",
        "model": "ollama/kimi-k2.5:cloud",
        "lastMessagePreview": "Let me check the implementation..."
      }
    ]
  },
  "error": null
}
```

---

### `sessions.patch` — Update session settings

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "sessions.patch",
  "params": {
    "key": "main:abc123...",
    "model": "ollama/glm-5:cloud",
    "thinkingLevel": "medium",
    "verboseLevel": "concise",
    "reasoningLevel": "on"
  }
}
```

---

### `sessions.reset` — Reset/clear a session

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "sessions.reset",
  "params": {
    "key": "main:abc123...",
    "reason": "Switching topics"
  }
}
```

---

### `agents.list` — List available agents

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "agents.list",
  "params": {}
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "defaultId": "main",
    "agents": [
      { "id": "main", "name": "Asha" },
      { "id": "cody", "name": "Cody (Coder)" },
      { "id": "qa", "name": "QA (Quality)" },
      { "id": "bro", "name": "Bro (Researcher)" },
      { "id": "review", "name": "Review (Local Ollama)" }
    ]
  },
  "error": null
}
```

**NOTE:** Sub-agent spawning uses `/api/sessions.spawn`, not this RPC method (security).

---

### `status` — Get gateway status

**Request:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "status",
  "params": {}
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": {
    "ready": true,
    "version": "2026.2.15",
    "uptime": 3600,
    "sessions": 3,
    "agents": 5
  },
  "error": null
}
```

---

## Server-Push Events

During `chat.send`, the server streams updates:

| Event | Payload | Description |
|-------|---------|-------------|
| `chat.chunk` | `{ "delta": "text", "runId": "..." }` | Token stream |
| `chat.done` | `{ "runId": "..." }` | Complete |
| `chat.error` | `{ "error": "...", "runId": "..." }` | Error occurred |
| `chat.aborted` | `{ "runId": "..." }` | Aborted by user |

**Example stream:**
```json
{ "event": "chat.chunk", "payload": { "delta": "Hello", "runId": "run-xyz" }, "seq": 1 }
{ "event": "chat.chunk", "payload": { "delta": " there", "runId": "run-xyz" }, "seq": 2 }
{ "event": "chat.done", "payload": { "runId": "run-xyz" }, "seq": 3 }
```

---

## Testing Checklist

- [ ] Connect with token → should see `helloOk`
- [ ] `models.list` → returns your Ollama + GitHub Copilot models
- [ ] `agents.list` → shows main, cody, qa, bro, review
- [ ] `sessions.list` → returns sessions (may be empty initially)
- [ ] `chat.send` → sends message, receives streaming chunks
- [ ] `chat.abort` → cancels ongoing generation
- [ ] `sessions.patch` → change model mid-session
- [ ] `sessions.reset` → clears session context
- [ ] `status` → returns gateway health

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid/missing token | Check token in URL param |
| `404 Method not found` | RPC method typo | Verify method name |
| `Params validation failed` | Wrong params structure | Check required fields |
| `Session not found` | Bad sessionKey | Verify key from sessions.list |
