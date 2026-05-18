# Zinc Carbon Web Search MCP Server

[![npm version](https://img.shields.io/npm/v/zinc-carbon-web-search?color=blue&logo=npm)](https://www.npmjs.com/package/zinc-carbon-web-search)
[![Docker Pulls](https://img.shields.io/docker/pulls/farukcan/zinc-carbon-web-search?logo=docker&color=2496ED)](https://hub.docker.com/r/farukcan/zinc-carbon-web-search)
[![Docker Image Size](https://img.shields.io/docker/image-size/farukcan/zinc-carbon-web-search?logo=docker&color=2496ED)](https://hub.docker.com/r/farukcan/zinc-carbon-web-search)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.51-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blueviolet)](https://modelcontextprotocol.io)
[![Search: DuckDuckGo](https://img.shields.io/badge/Search-DuckDuckGo-DE5833?logo=duckduckgo&logoColor=white)](https://duckduckgo.com)
[![Search: Google](https://img.shields.io/badge/Search-Google-4285F4?logo=google&logoColor=white)](https://google.com)
[![HTTP Mode](https://img.shields.io/badge/Transport-HTTP%20%7C%20Stdio-orange)](https://modelcontextprotocol.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/farukcan/zinc-carbon-web-search/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/farukcan/zinc-carbon-web-search?style=social)](https://github.com/farukcan/zinc-carbon-web-search)

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

### Docker Mode

Start the server with Docker, then connect via HTTP:

```bash
docker run -p 3000:3000 farukcan/zinc-carbon-web-search
```

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

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

### Using the Pre-built Image (recommended)

The image is available on Docker Hub and can be used directly:

```bash
# Pull and run (HTTP mode on port 3000)
docker run -p 3000:3000 farukcan/zinc-carbon-web-search

# Run with custom port
docker run -p 8080:8080 farukcan/zinc-carbon-web-search node dist/index.js --http --port 8080
```

### Building from Source

```bash
# Build
docker build -t zinc-carbon-web-search .

# Run
docker run -p 3000:3000 zinc-carbon-web-search
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
