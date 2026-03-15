# Zinc Carbon Web Search MCP Server

Playwright kullanarak web araması yapan bir MCP (Model Context Protocol) server. Google ve DuckDuckGo'yu destekler; DuckDuckGo primary engine olarak kullanılır, Google fallback olarak devreye girer.

## Gereksinimler

- Node.js 18+
- Google Chrome (sistem genelinde kurulu olmalı)

> Sistemde Chrome yoksa Playwright kendi Chromium'unu kullanır. `npx playwright install chromium` ile kurabilirsin.

## Kurulum

```bash
npm install
npm run build
```

## Kullanım

### Stdio Modu (Cursor / Claude Desktop)

```bash
node dist/index.js
```

### Streamable HTTP Modu

```bash
# Varsayılan port: 3000
node dist/index.js --http

# Özel port
node dist/index.js --http --port 8080
```

HTTP modunda endpoint: `POST http://localhost:3000/mcp`

## Cursor'a Entegrasyon

### Stdio Modu (önerilen)

`~/.cursor/mcp.json` dosyasına ekle:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/tam/yol/ZincCarbonWebSearch/dist/index.js"]
    }
  }
}
```

### HTTP Modu (Streamable HTTP)

Önce sunucuyu ayağa kaldır:

```bash
node dist/index.js --http --port 3000
```

Ardından `~/.cursor/mcp.json` dosyasına ekle:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

> HTTP modunda sunucunun her zaman çalışıyor olması gerekir. Stdio modunda ise Cursor sunucuyu otomatik başlatır ve yönetir.

### Docker Modu

Docker ile sunucuyu başlat, ardından HTTP üzerinden bağlan:

```bash
docker run -p 3000:3000 farukcan/zinc-carbon-web-search
```

`~/.cursor/mcp.json` dosyasına ekle:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Araçlar (Tools)

### `search`

Web araması yapar.

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `query` | string | ✓ | Arama sorgusu |
| `limit` | number | — | Maksimum sonuç sayısı (varsayılan: 5, max: 10) |
| `engine` | string | — | Arama motoru: `auto` \| `duckduckgo` \| `google` (varsayılan: `auto`) |

**Engine davranışı:**

| Değer | Açıklama |
|-------|----------|
| `auto` | Önce DuckDuckGo dener, 0 sonuç veya hata olursa Google'a fallback yapar |
| `duckduckgo` | Yalnızca DuckDuckGo kullanır |
| `google` | Yalnızca Google kullanır |

> **Not:** Google, headless Chrome'u genellikle CAPTCHA ile engeller. `google` engine'i yalnızca non-headless veya CAPTCHA bypass mekanizması olan ortamlarda güvenilir çalışır. `auto` ve `duckduckgo` önerilir.

**Örnek çıktı:**

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

### Hazır Image Kullanımı (önerilen)

Image Docker Hub'da yayınlanmaktadır ve doğrudan kullanılabilir:

```bash
# Çek ve çalıştır (HTTP modunda, port 3000)
docker run -p 3000:3000 farukcan/zinc-carbon-web-search

# Özel port ile çalıştır
docker run -p 8080:8080 farukcan/zinc-carbon-web-search node dist/index.js --http --port 8080
```

### Kaynaktan Derleme

```bash
# Build
docker build -t zinc-carbon-web-search .

# Çalıştır
docker run -p 3000:3000 zinc-carbon-web-search
```

Docker image multi-stage build ile `node:22-slim` tabanlı oluşturulur ve yalnızca Chromium browser kurulur. Varsayılan entrypoint `--http` modudur.

## Proje Yapısı

```
src/
├── index.ts    — Entry point; transport seçimi (stdio / HTTP), graceful shutdown
├── server.ts   — McpServer oluşturma, search tool kaydı
└── search.ts   — SearchService; Playwright browser yönetimi, Google/DuckDuckGo scraping
```

## NPM Scriptleri

| Script | Açıklama |
|--------|----------|
| `npm run build` | TypeScript derle (`dist/` klasörüne) |
| `npm start` | Stdio modunda başlat |
| `npm run start:http` | HTTP modunda başlat (port 3000) |
