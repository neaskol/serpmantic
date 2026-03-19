import { NextRequest, NextResponse } from 'next/server'
import { fetchSerpResults } from '@/lib/serp'
import { crawlPage, type CrawledPage } from '@/lib/crawler'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/scoring'
import type { SemanticTerm } from '@/types/database'
import { AnalyzeRequestSchema } from '@/lib/schemas'
import { serpRateLimit, getUserIdentifier, checkRateLimit } from '@/lib/rate-limit'
import { getCachedSerpAnalysis, setCachedSerpAnalysis } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

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

    // 4. Fetch SERP results (cache miss)
    logger.info('Fetching SERP results', { keyword, engine })
    const serpResults = await fetchSerpResults(keyword, lang, engine)
    logger.info('SERP results fetched', { numResults: serpResults.length })

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

    // 6. Send texts to NLP service
    logger.info('Calling NLP service', {
      language: lang,
      numPages: crawledPages.length,
    })
    const nlpStartTime = Date.now()
    const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: crawledPages.map(p => p.text),
        language: lang,
      }),
    })

    if (!nlpResponse.ok) {
      throw new Error(`NLP service returned ${nlpResponse.status}`)
    }

    const nlpData = await nlpResponse.json()
    logger.info('NLP analysis completed', {
      termsFound: nlpData.terms?.length || 0,
      termsToAvoid: nlpData.terms_to_avoid?.length || 0,
      duration: Date.now() - nlpStartTime,
    })

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

    // Insert SERP pages
    const { error: pagesError } = await supabase
      .from('serp_pages')
      .insert(serpPagesData.map(p => ({ ...p, serp_analysis_id: analysis.id })))

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to save SERP pages', detail: pagesError }, { status: 500 })
    }

    // Insert semantic terms
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

    const { error: termsError } = await supabase
      .from('semantic_terms')
      .insert(termsToInsert)

    if (termsError) {
      return NextResponse.json({ error: 'Failed to save terms', detail: termsError }, { status: 500 })
    }

    // 9. Return the complete data
    const { data: savedTerms } = await supabase
      .from('semantic_terms')
      .select()
      .eq('serp_analysis_id', analysis.id)

    const { data: savedPages } = await supabase
      .from('serp_pages')
      .select()
      .eq('serp_analysis_id', analysis.id)
      .order('position')

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
