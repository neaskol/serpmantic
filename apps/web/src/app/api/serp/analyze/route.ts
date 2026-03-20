import { NextRequest, NextResponse } from 'next/server'
import { fetchSerpResults } from '@/lib/serp'
import { crawlPage, type CrawledPage } from '@/lib/crawler'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/scoring'
import type { SemanticTerm } from '@/types/database'
import { AnalyzeRequestSchema } from '@/lib/schemas'
import { serpRateLimit, getUserIdentifier, checkRateLimit } from '@/lib/rate-limit'
import { getCachedSerpAnalysis, setCachedSerpAnalysis, getCachedSerpResults, setCachedSerpResults } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { getNlpCacheEntries, setNlpCacheEntries } from '@/lib/nlp-cache'
import { aggregateNlpResults } from '@/lib/nlp-aggregator'

/**
 * @swagger
 * /api/serp/analyze:
 *   post:
 *     summary: Analyze SERP for semantic optimization
 *     description: |
 *       Analyzes Google SERP results for a keyword to extract semantic terms, structural benchmarks, and competitive insights.
 *
 *       **Process:**
 *       1. Rate limit check (5 requests/hour)
 *       2. Cache lookup (24h TTL)
 *       3. Fetch top 10 SERP results
 *       4. Crawl and extract content from each page
 *       5. NLP analysis: tokenization → lemmatization → TF-IDF
 *       6. Calculate percentile benchmarks (P10-P90)
 *       7. Store results and return analysis
 *
 *       **Caching:** Results are cached for 24 hours to reduce API costs and improve response time.
 *     tags:
 *       - SERP Analysis
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword
 *               - language
 *               - searchEngine
 *               - guideId
 *             properties:
 *               keyword:
 *                 type: string
 *                 description: Target SEO keyword to analyze
 *                 example: delegataire cee
 *               language:
 *                 type: string
 *                 enum: [fr, en, it, de, es]
 *                 description: Language for SERP analysis
 *                 default: fr
 *               searchEngine:
 *                 type: string
 *                 description: Target search engine
 *                 example: google.fr
 *               guideId:
 *                 type: string
 *                 format: uuid
 *                 description: Guide ID to link analysis to
 *     responses:
 *       200:
 *         description: SERP analysis completed successfully
 *         headers:
 *           X-Cache:
 *             description: Cache status (HIT or MISS)
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *           X-RateLimit-Limit:
 *             description: Request limit per hour
 *             schema:
 *               type: integer
 *           X-RateLimit-Remaining:
 *             description: Remaining requests in current window
 *             schema:
 *               type: integer
 *           X-RateLimit-Reset:
 *             description: Unix timestamp when limit resets
 *             schema:
 *               type: integer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SerpAnalysis'
 *       400:
 *         description: Validation error - invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded (5 requests/hour)
 *         headers:
 *           Retry-After:
 *             description: Seconds until next request allowed
 *             schema:
 *               type: integer
 *           X-RateLimit-Limit:
 *             schema:
 *               type: integer
 *           X-RateLimit-Remaining:
 *             schema:
 *               type: integer
 *           X-RateLimit-Reset:
 *             schema:
 *               type: integer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Rate limit exceeded
 *                 message:
 *                   type: string
 *                 limit:
 *                   type: integer
 *                 remaining:
 *                   type: integer
 *                 reset:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('SERP analysis started', { requestId })

    // 1. Rate limiting check (before validation to save resources)
    const identifier = getUserIdentifier(request)
    const rateLimitResult = await checkRateLimit(serpRateLimit, identifier)

    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', {
        identifier,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
      })
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'You have exceeded the maximum number of SERP analyses per hour (5). Please try again later.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // 2. Validate request body with Zod
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)

    const { keyword, language, searchEngine, guideId } = validatedData
    const lang = language
    const engine = searchEngine

    // 3. Check cache first (skip expensive SERP analysis if cached)
    const cached = await getCachedSerpAnalysis(keyword, lang)
    if (cached) {
      logger.info('Cache hit', {
        keyword,
        language: lang,
        requestId,
        duration: Date.now() - startTime,
      })
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      })
    }

    logger.info('Cache miss', { keyword, language: lang, requestId })

    // 4. Fetch SERP results (check SERP results cache first)
    let serpResults = await getCachedSerpResults(keyword, lang, engine) as Awaited<ReturnType<typeof fetchSerpResults>> | null

    if (serpResults) {
      logger.info('SERP results cache hit', { keyword, engine, numResults: serpResults.length })
    } else {
      logger.info('Fetching SERP results from SerpAPI', { keyword, engine })
      serpResults = await fetchSerpResults(keyword, lang, engine)
      logger.info('SERP results fetched', { numResults: serpResults.length })

      // Cache raw SERP results for future requests with same keyword
      await setCachedSerpResults(keyword, lang, engine, serpResults)
    }

    if (serpResults.length === 0) {
      return NextResponse.json({ error: 'No SERP results found' }, { status: 404 })
    }

    // 5. Crawl pages in parallel
    logger.info('Crawling SERP pages', { numPages: serpResults.length })
    const crawlPromises = serpResults.map(r => crawlPage(r.link))
    const crawledPages = (await Promise.all(crawlPromises)).filter(Boolean) as CrawledPage[]
    logger.info('Pages crawled', {
      successful: crawledPages.length,
      total: serpResults.length,
    })

    if (crawledPages.length < 2) {
      return NextResponse.json({ error: 'Not enough pages could be crawled' }, { status: 500 })
    }

    // 6. Check NLP cache for per-URL results
    const crawledUrls = crawledPages.map(p => p.url)
    const { cached: nlpCached, uncachedUrls } = await getNlpCacheEntries(crawledUrls, lang)

    logger.info('NLP cache check', {
      total: crawledPages.length,
      cached: nlpCached.size,
      uncached: uncachedUrls.length,
    })

    let nlpData: { terms: any[]; terms_to_avoid: string[] }

    if (uncachedUrls.length === 0) {
      // All URLs cached — reconstruct from cached lemma lists (no NLP call!)
      const lemmaLists = crawledPages.map(p => {
        const entry = nlpCached.get(p.url)
        return entry ? (entry.lemmas as string[]) : []
      })
      nlpData = aggregateNlpResults(lemmaLists)

      logger.info('NLP analysis from cache (0 TextRazor calls)', {
        termsFound: nlpData.terms.length,
        termsToAvoid: nlpData.terms_to_avoid.length,
      })
    } else {
      // Some or all URLs uncached — call NLP service with per-URL lemma return
      const uncachedPages = crawledPages.filter(p => uncachedUrls.includes(p.url))

      const nlpStartTime = Date.now()
      const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze-with-lemmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: uncachedPages.map(p => p.text),
          language: lang,
        }),
      })

      if (!nlpResponse.ok) {
        throw new Error(`NLP service returned ${nlpResponse.status}`)
      }

      const freshData = await nlpResponse.json()

      logger.info('NLP service response', {
        duration: Date.now() - nlpStartTime,
        textrazorCalls: uncachedPages.length,
        savedCalls: nlpCached.size,
      })

      // Cache fresh per-URL results
      if (freshData.per_url_lemmas) {
        const cacheEntries = uncachedPages.map((page, i) => ({
          url: page.url,
          language: lang,
          lemmas: freshData.per_url_lemmas[i] || [],
          entities: freshData.per_url_entities?.[i] || [],
          topics: freshData.per_url_topics?.[i] || [],
        }))
        await setNlpCacheEntries(cacheEntries)
      }

      if (nlpCached.size === 0) {
        // None cached — use fresh NLP response directly
        nlpData = { terms: freshData.terms, terms_to_avoid: freshData.terms_to_avoid }
      } else {
        // Partial cache — merge cached + fresh lemmas, re-aggregate
        const allLemmas = crawledPages.map(p => {
          const cachedEntry = nlpCached.get(p.url)
          if (cachedEntry) return cachedEntry.lemmas as string[]
          const freshIdx = uncachedPages.findIndex(up => up.url === p.url)
          return freshData.per_url_lemmas?.[freshIdx] || []
        })
        nlpData = aggregateNlpResults(allLemmas)
      }

      logger.info('NLP analysis completed', {
        termsFound: nlpData.terms.length,
        termsToAvoid: nlpData.terms_to_avoid.length,
      })
    }

    // 7. Calculate structural benchmarks (P10-P90)
    const metricsArrays = {
      words: crawledPages.map(p => p.metrics.words),
      headings: crawledPages.map(p => p.metrics.headings),
      paragraphs: crawledPages.map(p => p.metrics.paragraphs),
      links: crawledPages.map(p => p.metrics.links),
      images: crawledPages.map(p => p.metrics.images),
      videos: crawledPages.map(p => p.metrics.videos),
      tables: crawledPages.map(p => p.metrics.tables),
      lists: crawledPages.map(p => p.metrics.lists),
    }

    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b)
      const idx = Math.ceil((p / 100) * sorted.length) - 1
      return sorted[Math.max(0, idx)]
    }

    const structuralBenchmarks: Record<string, { min: number; max: number }> = {}
    for (const [key, values] of Object.entries(metricsArrays)) {
      structuralBenchmarks[key] = {
        min: percentile(values, 10),
        max: percentile(values, 90),
      }
    }

    // 8. Build semantic terms for scoring each SERP page
    const semanticTermsForScoring: SemanticTerm[] = nlpData.terms.map((t: Record<string, unknown>, i: number) => ({
      id: `temp-${i}`,
      serp_analysis_id: '',
      term: t.term as string,
      display_term: t.display_term as string,
      is_main_keyword: (t.term as string).includes(keyword.toLowerCase()),
      min_occurrences: t.min_occurrences as number,
      max_occurrences: t.max_occurrences as number,
      importance: t.importance as number,
      term_type: t.term_type as 'unigram' | 'bigram' | 'trigram' | 'phrase',
      is_to_avoid: false,
    }))

    // 6. Calculate score for each SERP page
    const serpPagesData = crawledPages.map((page, i) => {
      const result = calculateScore(page.text, semanticTermsForScoring)
      return {
        url: page.url,
        title: page.title || serpResults[i]?.title || '',
        score: result.score,
        is_excluded: false,
        metrics: page.metrics,
        term_occurrences: Object.fromEntries(
          result.termStatuses.map(ts => [ts.term.term, ts.count])
        ),
        position: i + 1,
      }
    })

    // 7. Calculate refresh interval (simplified: default 6 months)
    const refreshIntervalMonths = 6
    const refreshDate = new Date()
    refreshDate.setMonth(refreshDate.getMonth() + refreshIntervalMonths)

    // 8. Store in Supabase
    const supabase = await createClient()

    // Delete existing analysis for this guide
    await supabase.from('serp_analyses').delete().eq('guide_id', guideId)

    // Insert SERP analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('serp_analyses')
      .insert({
        guide_id: guideId,
        keyword,
        language: lang,
        structural_benchmarks: structuralBenchmarks,
        refresh_interval_months: refreshIntervalMonths,
        refresh_recommended_at: refreshDate.toISOString(),
      })
      .select()
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Failed to save analysis', detail: analysisError }, { status: 500 })
    }

    // Insert SERP pages (with .select() to get inserted data in one round trip)
    const { data: savedPages, error: pagesError } = await supabase
      .from('serp_pages')
      .insert(serpPagesData.map(p => ({ ...p, serp_analysis_id: analysis.id })))
      .select()
      .order('position')

    if (pagesError || !savedPages) {
      return NextResponse.json({ error: 'Failed to save SERP pages', detail: pagesError }, { status: 500 })
    }

    // Insert semantic terms (with .select() to get inserted data in one round trip)
    const termsToInsert = [
      ...nlpData.terms.map((t: Record<string, unknown>) => ({
        serp_analysis_id: analysis.id,
        term: t.term,
        display_term: t.display_term,
        is_main_keyword: (t.term as string).includes(keyword.toLowerCase()),
        min_occurrences: t.min_occurrences,
        max_occurrences: t.max_occurrences,
        importance: t.importance,
        term_type: t.term_type,
        is_to_avoid: false,
      })),
      ...nlpData.terms_to_avoid.map((term: string) => ({
        serp_analysis_id: analysis.id,
        term,
        display_term: term,
        is_main_keyword: false,
        min_occurrences: 0,
        max_occurrences: 0,
        importance: 0,
        term_type: 'unigram',
        is_to_avoid: true,
      })),
    ]

    const { data: savedTerms, error: termsError } = await supabase
      .from('semantic_terms')
      .insert(termsToInsert)
      .select()

    if (termsError || !savedTerms) {
      return NextResponse.json({ error: 'Failed to save terms', detail: termsError }, { status: 500 })
    }

    const result = {
      analysis,
      pages: savedPages,
      terms: savedTerms,
    }

    // 10. Cache the result for future requests (24h TTL)
    await setCachedSerpAnalysis(keyword, lang, result)
    logger.info('Results cached', { keyword, language: lang, ttl: 86400 })

    logger.info('SERP analysis completed', {
      keyword,
      language: lang,
      score: result.analysis?.score || 0,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(result, {
      headers: {
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      },
    })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/serp/analyze',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
