# Zinc Carbon Web Search MCP Server

An MCP (Model Context Protocol) server that performs web searches using Playwright. Supports Google and DuckDuckGo; DuckDuckGo is used as the primary engine, with Google as a fallback.

## Requirements

- Node.js 18+
- Google Chrome (installed system-wide)

> If Chrome is not available on the system, Playwright will use its own Chromium. You can install it with `npx playwright install chromium`.

## Installation

```bash
npm install
npm run build
```

## Usage

### Stdio Mode (Cursor / Claude Desktop)

```bash
node dist/index.js
```

### Streamable HTTP Mode

```bash
# Default port: 3000
node dist/index.js --http

# Custom port
node dist/index.js --http --port 8080
```

In HTTP mode, the endpoint is: `POST http://localhost:3000/mcp`

## Cursor Integration

### Stdio Mode (recommended)

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/full/path/ZincCarbonWebSearch/dist/index.js"]
    }
  }
}
```

### HTTP Mode (Streamable HTTP)

First, start the server:

```bash
node dist/index.js --http --port 3000
```

Then add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

> In HTTP mode, the server must always be running. In Stdio mode, Cursor automatically starts and manages the server.

## Tools

### `search`

Performs a web search.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✓ | Search query |
| `limit` | number | — | Maximum number of results (default: 5, max: 10) |
| `engine` | string | — | Search engine: `auto` \| `duckduckgo` \| `google` (default: `auto`) |

**Engine behavior:**

| Value | Description |
|-------|-------------|
| `auto` | Tries DuckDuckGo first, falls back to Google if 0 results or error |
| `duckduckgo` | Uses only DuckDuckGo |
| `google` | Uses only Google |

> **Note:** Google often blocks headless Chrome with CAPTCHA. The `google` engine only works reliably in non-headless environments or those with CAPTCHA bypass mechanisms. `auto` and `duckduckgo` are recommended.

**Example output:**

```json
[
  {
    "title": "Playwright - Fast and reliable end-to-end testing",
    "url": "https://playwright.dev",
    "description": "Playwright enables reliable end-to-end testing for modern web apps."
  }
]
```

## Docker

```bash
# Build
docker build -t zinc-carbon-web-search .

# Run (HTTP mode on port 3000)
docker run -p 3000:3000 zinc-carbon-web-search

# Run with custom port
docker run -p 8080:8080 zinc-carbon-web-search node dist/index.js --http --port 8080
```

The Docker image uses a multi-stage build with `node:22-slim` and installs only the Chromium browser via Playwright. The `--http` mode is the default entrypoint.

## Project Structure

```
src/
├── index.ts    — Entry point; transport selection (stdio / HTTP), graceful shutdown
├── server.ts   — McpServer creation, search tool registration
└── search.ts   — SearchService; Playwright browser management, Google/DuckDuckGo scraping
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript (to `dist/`) |
| `npm start` | Start in stdio mode |
| `npm run start:http` | Start in HTTP mode (port 3000) |
