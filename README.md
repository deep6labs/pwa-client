# PWA WebSocket Chat Gateway Client

A lightweight Progressive Web App client for the OpenClaw WebSocket chat gateway.

**Repository:** https://github.com/deep6labs/pwa-client

## Run locally

Serve the folder with any static server:

```bash
cd /home/asha/repos/pwa-client
python3 -m http.server 8080
```

Open: http://localhost:8080

## Connect

1. Enter the WebSocket URL (e.g. `ws://localhost:3000`).
2. Optionally enter a token; it will be appended as `?token=`.
3. Click **Connect**.

## Chat usage

- Type a message and press **Enter** to send.
- Use **Shift+Enter** for newline.
- Messages support Markdown rendering (assistant messages) and code highlighting.

## Slash commands

```
/help
/model [provider/model]
/models
/session [key]
/sessions
/agent [id]
/agents
/status
/reset
/abort
```

## PWA

Install from the browser menu once loaded. Service worker caches the app shell for offline use.
