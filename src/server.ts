import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SearchService, type SearchEngine } from './search.js';

export function createServer(searchService: SearchService): McpServer {
  const server = new McpServer({
    name: 'zinc-carbon-web-search',
    version: '1.0.0',
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
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Maximum number of results to return (default: 5)'),
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
      const results = await searchService.search(query, limit ?? 5, (engine ?? 'auto') as SearchEngine);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
