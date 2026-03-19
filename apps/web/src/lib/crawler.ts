import * as cheerio from 'cheerio'
import { logger } from './logger'

export interface CrawledPage {
  url: string
  title: string
  text: string
  metrics: {
    words: number
    headings: number
    paragraphs: number
    links: number
    images: number
    videos: number
    tables: number
    lists: number
  }
}

export async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    logger.debug('Crawling page', { url })

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SERPmantics/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      logger.warn('Page crawl failed - HTTP error', { url, status: response.status })
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove non-editorial content
    $('nav, footer, header, aside, script, style, noscript, iframe, .cookie, .nav, .sidebar, .menu, .footer, .header, .ad, .advertisement').remove()

    // Extract editorial text
    const editorialSelectors = ['article', 'main', '[role="main"]', '.content', '.post-content', '.entry-content']
    let $editorial = $(editorialSelectors.join(', '))
    if ($editorial.length === 0) {
      $editorial = $('body')
    }

    const text = $editorial.text().replace(/\s+/g, ' ').trim()
    const title = $('title').text().trim() || $('h1').first().text().trim()

    // Count structural metrics on the full page body
    const $body = $('body')
    const metrics = {
      words: text.split(/\s+/).filter(Boolean).length,
      headings: $body.find('h1, h2, h3, h4, h5, h6').length,
      paragraphs: $body.find('p').length,
      links: $body.find('a[href]').length,
      images: $body.find('img').length,
      videos: $body.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      tables: $body.find('table').length,
      lists: $body.find('ul, ol').length,
    }

    logger.debug('Page crawled', {
      url,
      textLength: text.length,
      title: title.substring(0, 50),
      words: metrics.words,
    })

    return { url, title, text, metrics }
  } catch (error) {
    logger.warn('Page crawl failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
