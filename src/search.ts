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

  async fetchSearchPageHtml(url: string): Promise<string> {
    if (!this.context) throw new Error('SearchService not initialized');
    const page = await this.context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      return await page.content();
    } finally {
      await page.close();
    }
  }

  async search(query: string, limit: number, engine: SearchEngine = 'auto', locale: string = 'en'): Promise<SearchResult[]> {
    if (engine === 'duckduckgo') {
      return this.searchDuckDuckGo(query, limit, locale);
    }

    if (engine === 'google') {
      return this.searchGoogle(query, limit, locale);
    }

    // auto: DuckDuckGo primary, Google fallback
    const errors: string[] = [];
    try {
      const results = await this.searchDuckDuckGo(query, limit, locale);
      if (results.length > 0) return results;
      errors.push('DuckDuckGo returned 0 results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`DuckDuckGo failed: ${msg}`);
    }

    try {
      const results = await this.searchGoogle(query, limit, locale);
      if (results.length > 0) return results;
      errors.push('Google returned 0 results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Google failed: ${msg}`);
    }

    throw new Error(`All engines failed for "${query}": ${errors.join(' | ')}`);
  }

  private async searchGoogle(query: string, limit: number, locale: string = 'en'): Promise<SearchResult[]> {
    if (!this.context) throw new Error('SearchService not initialized');
    const lang = locale.split('-')[0];

    const page = await this.context.newPage();
    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': `${locale},${lang};q=0.9` });
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${lang}&num=${limit}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );

      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (bodyText.includes('unusual traffic') || bodyText.includes('CAPTCHA')) {
        throw new Error('Google CAPTCHA detected');
      }

      const consentButton = page
        .locator('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Tümünü kabul et")')
        .first();
      if (await consentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await consentButton.click();
        await page.waitForLoadState('domcontentloaded');
      }

      const results: SearchResult[] = [];
      const headings = page.locator('h3.LC20lb');
      const count = await headings.count();

      for (let i = 0; i < count && results.length < limit; i++) {
        const heading = headings.nth(i);
        const title = await heading.textContent().catch(() => null);
        const link = heading.locator('xpath=ancestor::a[1]');
        const href = await link.getAttribute('href').catch(() => null);
        const container = heading.locator('xpath=ancestor::div[contains(@class,"tF2Cxc")]');
        const description = await container
          .locator('.VwiC3b, .IsZvec, [style*="-webkit-line-clamp"]')
          .first()
          .textContent()
          .catch(() => '');

        if (title && href && href.startsWith('http')) {
          results.push({ title: title.trim(), url: href, description: description?.trim() ?? '' });
        }
      }

      if (results.length === 0) {
        const snippet = bodyText.substring(0, 500);
        throw new Error(`Google: no results matched selectors. Page snippet: ${snippet}`);
      }

      return results;
    } finally {
      await page.close();
    }
  }

  private async searchDuckDuckGo(query: string, limit: number, locale: string = 'en'): Promise<SearchResult[]> {
    if (!this.context) throw new Error('SearchService not initialized');
    const parts = locale.split('-');
    const lang = parts[0]!.toLowerCase();
    const country = parts.length > 1 ? parts[1]!.toLowerCase() : lang;
    const kl = `${country}-${lang}`;

    const page = await this.context.newPage();
    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': `${locale},${lang};q=0.9` });
      await page.goto(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=${kl}&ia=web`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );

      await page.waitForSelector('[data-testid="result"]', { timeout: 10000 }).catch(() => null);

      const results: SearchResult[] = [];
      const blocks = page.locator('[data-testid="result"]');
      const count = await blocks.count();

      for (let i = 0; i < count && results.length < limit; i++) {
        const block = blocks.nth(i);
        const titleEl = block.locator('[data-testid="result-title-a"]').first();
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

      if (results.length === 0) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const snippet = bodyText.substring(0, 500);
        throw new Error(`DuckDuckGo: no results matched selectors. Page snippet: ${snippet}`);
      }

      return results;
    } finally {
      await page.close();
    }
  }
}
