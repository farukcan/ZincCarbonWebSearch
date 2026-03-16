import { createRequire } from 'module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SearchService, type SearchEngine } from './search.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export function createServer(searchService: SearchService): McpServer {
  const server = new McpServer({
    name: 'zinc-carbon-web-search',
    version,
  });

  server.registerTool(
    'search',
    {
      title: 'Web Search',
      description:
        'Search the web and return results with title, URL and description. ' +
        'Uses DuckDuckGo by default. Google may be blocked in headless mode (CAPTCHA).',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z
          .string()
          .optional()
          .describe('Maximum number of results to return, 1-10 (default: 5)'),
        engine: z
          .enum(['auto', 'duckduckgo', 'google'])
          .optional()
          .describe(
            'Search engine to use. "auto" tries DuckDuckGo first, falls back to Google. ' +
            'Default: "auto"'
          ),
      }),
    },
    async ({ query, limit, engine }) => {
      try {
        const parsedLimit = Math.min(10, Math.max(1, parseInt(limit ?? '5', 10) || 5));
        const results = await searchService.search(query, parsedLimit, (engine ?? 'auto') as SearchEngine);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: message }],
        };
      }
    }
  );

  server.registerTool(
    'search-test-html',
    {
      title: 'Search Test HTML',
      description: 'Fetch raw HTML of a search engine results page for debugging selectors.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        engine: z
          .enum(['duckduckgo', 'google'])
          .describe('Search engine to fetch HTML from'),
      }),
    },
    async ({ query, engine }) => {
      try {
        const encodedQuery = encodeURIComponent(query);
        const url =
          engine === 'google'
            ? `https://www.google.com/search?q=${encodedQuery}&hl=en&num=5`
            : `https://duckduckgo.com/?q=${encodedQuery}&ia=web`;
        const html = await searchService.fetchSearchPageHtml(url);
        return {
          content: [{ type: 'text', text: html }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: message }],
        };
      }
    }
  );

  return server;
}
