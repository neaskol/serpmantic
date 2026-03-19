import { getJson } from 'serpapi'
import { logger } from './logger'

export interface SerpResult {
  position: number
  title: string
  link: string
  snippet: string
}

const EXCLUDED_DOMAINS = [
  'wikipedia.org', 'youtube.com', 'facebook.com', 'twitter.com',
  'instagram.com', 'linkedin.com', 'tiktok.com', 'pinterest.com',
]

export async function fetchSerpResults(keyword: string, language: string, searchEngine: string): Promise<SerpResult[]> {
  try {
    logger.info('Fetching SERP results', { keyword, searchEngine, provider: 'serpapi' })

    const params: Record<string, string> = {
      q: keyword,
      api_key: process.env.SERPAPI_KEY!,
      num: '10',
    }

    // Map language to Google domain
    if (searchEngine.includes('google.fr')) {
      params.google_domain = 'google.fr'
      params.hl = 'fr'
      params.gl = 'fr'
    } else {
      params.google_domain = 'google.com'
      params.hl = language
    }

    const data = await getJson('google', params)

    const results: SerpResult[] = (data.organic_results || [])
      .filter((r: { link: string }) => {
        const url = new URL(r.link)
        return !EXCLUDED_DOMAINS.some(d => url.hostname.includes(d))
      })
      .map((r: { position: number; title: string; link: string; snippet: string }, i: number) => ({
        position: i + 1,
        title: r.title,
        link: r.link,
        snippet: r.snippet || '',
      }))

    const finalResults = results.slice(0, 10)

    logger.info('SERP results received', {
      keyword,
      numResults: finalResults.length,
      provider: 'serpapi',
    })

    return finalResults
  } catch (error) {
    logger.error('SERP API failed', {
      keyword,
      searchEngine,
      provider: 'serpapi',
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch search results')
  }
}
