/**
 * Custom SERP Scraper - Alternative 100% gratuite à SerpAPI
 *
 * ⚠️ Limitations :
 * - Google peut bloquer si trop de requêtes
 * - Utiliser avec rate limiting (max 1 req/5s recommandé)
 * - Pour production, utiliser SerpAPI payant
 *
 * ✅ Avantages :
 * - Totalement gratuit
 * - Pas de limite de requêtes (avec modération)
 * - Contrôle total du scraping
 */

import * as cheerio from 'cheerio';

interface SerpResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface SerpData {
  keyword: string;
  totalResults: number;
  results: SerpResult[];
  relatedQuestions: string[];
  timestamp: Date;
}

/**
 * User agents rotatifs pour éviter la détection
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

/**
 * Delay entre requêtes pour éviter le rate limit
 */
const DELAY_MS = 2000;

/**
 * Récupère les résultats Google pour une requête
 */
export async function scrapeGoogleSerp(
  keyword: string,
  options: {
    country?: string;
    language?: string;
    numResults?: number;
  } = {}
): Promise<SerpData> {
  const {
    country = 'us',
    language = 'en',
    numResults = 10,
  } = options;

  try {
    // Construction de l'URL Google Search
    const searchParams = new URLSearchParams({
      q: keyword,
      num: numResults.toString(),
      hl: language,
      gl: country,
    });

    const url = `https://www.google.com/search?${searchParams.toString()}`;

    // User agent aléatoire
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // Fetch avec headers réalistes
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': `${language},en;q=0.9`,
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Google returned ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse avec Cheerio
    const $ = cheerio.load(html);

    // Extraction des résultats organiques
    const results: SerpResult[] = [];

    // Sélecteur Google (peut changer)
    $('.g').each((index, element) => {
      const $element = $(element);

      // Titre
      const title = $element.find('h3').first().text().trim();

      // URL
      const url = $element.find('a').first().attr('href') || '';

      // Snippet (description)
      const snippet = $element.find('.VwiC3b, .lEBKkf').first().text().trim();

      if (title && url) {
        results.push({
          position: index + 1,
          title,
          url: cleanUrl(url),
          snippet,
          domain: extractDomain(url),
        });
      }
    });

    // Extraction des questions associées (People Also Ask)
    const relatedQuestions: string[] = [];
    $('.related-question-pair, .kno-ftr').each((_, element) => {
      const question = $(element).find('span').first().text().trim();
      if (question) {
        relatedQuestions.push(question);
      }
    });

    // Nombre total de résultats
    const totalResultsText = $('#result-stats').text();
    const totalResults = extractTotalResults(totalResultsText);

    return {
      keyword,
      totalResults,
      results: results.slice(0, numResults),
      relatedQuestions,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('SERP scraping error:', error);
    throw new Error(`Failed to scrape Google SERP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Nettoie l'URL Google (retire les redirections)
 */
function cleanUrl(url: string): string {
  if (url.startsWith('/url?q=')) {
    try {
      const urlParams = new URLSearchParams(url.substring(5));
      return urlParams.get('q') || url;
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * Extrait le domaine d'une URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Extrait le nombre total de résultats
 */
function extractTotalResults(text: string): number {
  const match = text.match(/[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return 0;
}

/**
 * Scrape une page SERP et extrait son contenu
 */
export async function scrapePageContent(url: string): Promise<{
  title: string;
  content: string;
  headings: { level: number; text: string }[];
  wordCount: number;
  paragraphCount: number;
  linkCount: number;
  imageCount: number;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENTS[0],
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Suppression des éléments non-éditoriaux
    $('script, style, nav, header, footer, aside, iframe, .cookie-banner').remove();

    // Extraction du titre
    const title = $('h1').first().text().trim() || $('title').text().trim();

    // Extraction des headings
    const headings: { level: number; text: string }[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const $heading = $(element);
      const level = parseInt($heading.prop('tagName').replace('H', ''), 10);
      const text = $heading.text().trim();
      if (text) {
        headings.push({ level, text });
      }
    });

    // Extraction du contenu textuel
    const content = $('body').text().replace(/\s+/g, ' ').trim();

    // Métriques
    const wordCount = content.split(/\s+/).length;
    const paragraphCount = $('p').length;
    const linkCount = $('a').length;
    const imageCount = $('img').length;

    return {
      title,
      content,
      headings,
      wordCount,
      paragraphCount,
      linkCount,
      imageCount,
    };
  } catch (error) {
    console.error('Page scraping error:', error);
    throw new Error(`Failed to scrape page content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Rate limiter simple avec queue
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift();

    if (task) {
      await task();
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    this.processing = false;
    this.process();
  }
}

// Instance globale du rate limiter
const rateLimiter = new RateLimiter();

/**
 * Version rate-limited du scraper SERP
 */
export async function scrapeGoogleSerpSafe(
  keyword: string,
  options?: Parameters<typeof scrapeGoogleSerp>[1]
): Promise<SerpData> {
  return rateLimiter.add(() => scrapeGoogleSerp(keyword, options));
}

/**
 * Version rate-limited du scraper de page
 */
export async function scrapePageContentSafe(url: string) {
  return rateLimiter.add(() => scrapePageContent(url));
}

/**
 * Scrape complet : SERP + contenu des pages top-10
 */
export async function scrapeFullSerpAnalysis(
  keyword: string,
  options?: Parameters<typeof scrapeGoogleSerp>[1]
): Promise<{
  serpData: SerpData;
  pageContents: Awaited<ReturnType<typeof scrapePageContent>>[];
}> {
  // 1. Scrape la SERP
  const serpData = await scrapeGoogleSerpSafe(keyword, options);

  // 2. Scrape le contenu de chaque page (avec rate limiting)
  const pageContents = await Promise.all(
    serpData.results.map(result =>
      scrapePageContentSafe(result.url).catch(error => {
        console.error(`Failed to scrape ${result.url}:`, error);
        return null;
      })
    )
  );

  return {
    serpData,
    pageContents: pageContents.filter(Boolean) as Awaited<ReturnType<typeof scrapePageContent>>[],
  };
}

export default {
  scrapeGoogleSerp: scrapeGoogleSerpSafe,
  scrapePageContent: scrapePageContentSafe,
  scrapeFullSerpAnalysis,
};
