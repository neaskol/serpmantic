import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const NLP_CACHE_TTL_DAYS = 7

export interface NlpCacheEntry {
  url: string
  url_hash: string
  language: string
  lemmas: string[]
  entities: Array<{ text: string; type: string; relevance: number }>
  topics: Array<{ label: string; score: number }>
  analyzed_at: string
}

/**
 * Hash a URL using SHA-256 for cache key lookup.
 * Normalizes URL (lowercase, trim) before hashing.
 */
export async function hashUrl(url: string): Promise<string> {
  const normalized = url.toLowerCase().trim()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Look up NLP cache entries for a batch of URLs.
 * Returns cached results and list of uncached URLs.
 */
export async function getNlpCacheEntries(
  urls: string[],
  language: string
): Promise<{ cached: Map<string, NlpCacheEntry>; uncachedUrls: string[] }> {
  const cached = new Map<string, NlpCacheEntry>()
  const uncachedUrls: string[] = []

  if (urls.length === 0) {
    return { cached, uncachedUrls }
  }

  try {
    const supabase = await createClient()

    // Hash all URLs
    const urlHashes = await Promise.all(
      urls.map(async (url) => ({ url, hash: await hashUrl(url) }))
    )
    const hashToUrl = new Map(urlHashes.map(({ url, hash }) => [hash, url]))
    const hashes = urlHashes.map(({ hash }) => hash)

    // Query cache for all hashes at once
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NLP_CACHE_TTL_DAYS)

    const { data, error } = await supabase
      .from('nlp_cache')
      .select('*')
      .in('url_hash', hashes)
      .eq('language', language)
      .gte('analyzed_at', cutoff.toISOString())

    if (error) {
      logger.error('NLP cache lookup failed', { error: error.message })
      // On error, treat all as uncached (graceful degradation)
      return { cached, uncachedUrls: [...urls] }
    }

    // Build set of found hashes
    const foundHashes = new Set<string>()
    if (data) {
      for (const row of data) {
        foundHashes.add(row.url_hash)
        const originalUrl = hashToUrl.get(row.url_hash) || row.url
        cached.set(originalUrl, row as NlpCacheEntry)
      }
    }

    // Determine uncached URLs
    for (const { url, hash } of urlHashes) {
      if (!foundHashes.has(hash)) {
        uncachedUrls.push(url)
      }
    }

    logger.info('NLP cache lookup', {
      total: urls.length,
      hits: cached.size,
      misses: uncachedUrls.length,
      language,
    })
  } catch (error) {
    logger.error('NLP cache lookup error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { cached, uncachedUrls: [...urls] }
  }

  return { cached, uncachedUrls }
}

/**
 * Store NLP results in cache (upsert by url_hash + language).
 */
export async function setNlpCacheEntries(
  entries: Array<{
    url: string
    language: string
    lemmas: string[]
    entities: Array<{ text: string; type: string; relevance: number }>
    topics: Array<{ label: string; score: number }>
  }>
): Promise<void> {
  if (entries.length === 0) return

  try {
    const supabase = await createClient()

    const rows = await Promise.all(
      entries.map(async (entry) => ({
        url_hash: await hashUrl(entry.url),
        url: entry.url,
        language: entry.language,
        lemmas: entry.lemmas,
        entities: entry.entities,
        topics: entry.topics,
        analyzed_at: new Date().toISOString(),
      }))
    )

    const { error } = await supabase
      .from('nlp_cache')
      .upsert(rows, { onConflict: 'url_hash,language' })

    if (error) {
      logger.error('NLP cache store failed', { error: error.message })
    } else {
      logger.info('NLP cache entries stored', { count: rows.length })
    }
  } catch (error) {
    logger.error('NLP cache store error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Delete expired NLP cache entries (older than TTL).
 * Returns number of deleted rows.
 */
export async function cleanExpiredNlpCache(): Promise<number> {
  try {
    const supabase = await createClient()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NLP_CACHE_TTL_DAYS)

    const { data, error } = await supabase
      .from('nlp_cache')
      .delete()
      .lt('analyzed_at', cutoff.toISOString())
      .select('id')

    if (error) {
      logger.error('NLP cache cleanup failed', { error: error.message })
      return 0
    }

    const count = data?.length || 0
    logger.info('NLP cache cleanup', { deleted: count })
    return count
  } catch (error) {
    logger.error('NLP cache cleanup error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
