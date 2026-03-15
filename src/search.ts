import { chromium, type Browser, type BrowserContext } from 'playwright';

export type SearchEngine = 'auto' | 'duckduckgo' | 'google';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extractDuckDuckGoUrl(href: string): string | null {
  if (!href) return null;
  try {
    const full = href.startsWith('//') ? `https:${href}` : href;
    const parsed = new URL(full);
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (href.startsWith('http')) return href;
  } catch {
    // ignore
  }
  return null;
}

export class SearchService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async init(): Promise<void> {
    // Prefer system-installed Chrome (no browser download needed).
    // Falls back to the Playwright-managed Chromium if Chrome is not installed.
    try {
      this.browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    } catch {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    this.context = await this.browser.newContext({
      userAgent: USER_AGENT,
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
  }

  async search(query: string, limit: number, engine: SearchEngine = 'auto'): Promise<SearchResult[]> {
    if (engine === 'duckduckgo') {
      return this.searchDuckDuckGo(query, limit);
    }

    if (engine === 'google') {
      return this.searchGoogle(query, limit);
    }

    // auto: DuckDuckGo primary, Google fallback
    try {
      const results = await this.searchDuckDuckGo(query, limit);
      if (results.length > 0) return results;
      console.error('[SearchService] DuckDuckGo returned 0 results, trying Google');
    } catch (err) {
      console.error('[SearchService] DuckDuckGo failed:', err instanceof Error ? err.message : err);
    }

    try {
      return await this.searchGoogle(query, limit);
    } catch (err) {
      console.error('[SearchService] Google failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  private async searchGoogle(query: string, limit: number): Promise<SearchResult[]> {
    if (!this.context) throw new Error('SearchService not initialized');

    const page = await this.context.newPage();
    try {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=${limit}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );

      // Detect CAPTCHA / bot-detection page
      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (bodyText.includes('unusual traffic') || bodyText.includes('CAPTCHA')) {
        throw new Error('Google returned a CAPTCHA page — headless Chrome was detected');
      }

      // Accept consent/cookie dialog if present
      const consentButton = page
        .locator('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Tümünü kabul et")')
        .first();
      if (await consentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await consentButton.click();
        await page.waitForLoadState('domcontentloaded');
      }

      const results: SearchResult[] = [];
      const blocks = page.locator('div.g:has(h3)');
      const count = await blocks.count();

      for (let i = 0; i < count && results.length < limit; i++) {
        const block = blocks.nth(i);
        const title = await block.locator('h3').first().textContent().catch(() => null);
        const href = await block.locator('a[href]').first().getAttribute('href').catch(() => null);
        const description = await block
          .locator('.VwiC3b, [data-sncf], [style*="-webkit-line-clamp"]')
          .first()
          .textContent()
          .catch(() => '');

        if (title && href && href.startsWith('http')) {
          results.push({ title: title.trim(), url: href, description: description?.trim() ?? '' });
        }
      }

      return results;
    } finally {
      await page.close();
    }
  }

  private async searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
    if (!this.context) throw new Error('SearchService not initialized');

    const page = await this.context.newPage();
    try {
      await page.goto(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );

      // Wait for result articles to render
      await page.waitForSelector('article[data-testid] h2 a', { timeout: 10000 }).catch(() => null);

      const results: SearchResult[] = [];
      const blocks = page.locator('article[data-testid]');
      const count = await blocks.count();

      for (let i = 0; i < count && results.length < limit; i++) {
        const block = blocks.nth(i);
        const titleEl = block.locator('h2 a').first();
        const snippetEl = block.locator('[data-result="snippet"]').first();

        const title = await titleEl.textContent().catch(() => null);
        const href = await titleEl.getAttribute('href').catch(() => null);
        const description = await snippetEl.textContent().catch(() => '');

        if (!title || !href) continue;

        const url = extractDuckDuckGoUrl(href) ?? href;
        if (url.startsWith('http')) {
          results.push({ title: title.trim(), url, description: description?.trim() ?? '' });
        }
      }

      return results;
    } finally {
      await page.close();
    }
  }
}
