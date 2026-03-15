#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { SearchService } from './search.js';
import { createServer } from './server.js';

const args = process.argv.slice(2);
const useHttp = args.includes('--http');
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1] ?? '3000', 10) : 3000;

const searchService = new SearchService();

async function shutdown(): Promise<void> {
  await searchService.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await searchService.init();

if (useHttp) {
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  app.post('/mcp', async (req, res) => {
    const server = createServer(searchService);
    // No sessionIdGenerator = stateless mode
    const transport = new StreamableHTTPServerTransport();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    console.error(`Web Search MCP server running on http://0.0.0.0:${port}/mcp`);
  });
} else {
  const server = createServer(searchService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Web Search MCP server running on stdio');
}
