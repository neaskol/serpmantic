import { NextRequest, NextResponse } from 'next/server'
import { fetchSerpResults } from '@/lib/serp'
import { crawlPage, type CrawledPage } from '@/lib/crawler'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/scoring'
import type { SemanticTerm } from '@/types/database'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

/**
 * Background worker endpoint to process SERP analysis jobs
 * This runs independently and updates job status in real-time
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    logger.info('Processing SERP job', { jobId, requestId })

    const supabase = await createClient()

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('serp_jobs')
      .select('*, guides!inner(keyword, language, search_engine)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Update job to processing
    await supabase
      .from('serp_jobs')
      .update({
        status: 'processing',
        progress_step: 'fetching',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const guide = job.guides as any
    const { keyword, language: lang, search_engine: engine } = guide

    try {
      // Step 1: Fetch SERP results
      logger.info('Fetching SERP results', { keyword, engine })
      const serpResults = await fetchSerpResults(keyword, lang, engine)
      logger.info('SERP results fetched', { numResults: serpResults.length })

      if (serpResults.length === 0) {
        throw new Error('No SERP results found')
      }

      // Step 2: Crawl pages
      await supabase
        .from('serp_jobs')
        .update({ progress_step: 'crawling' })
        .eq('id', jobId)

      logger.info('Crawling SERP pages', { numPages: serpResults.length })
      const crawlPromises = serpResults.map(r => crawlPage(r.link))
      const crawledPages = (await Promise.all(crawlPromises)).filter(Boolean) as CrawledPage[]
      logger.info('Pages crawled', {
        successful: crawledPages.length,
        total: serpResults.length,
      })

      if (crawledPages.length < 2) {
        throw new Error('Not enough pages could be crawled')
      }

      // Step 3: NLP analysis
      await supabase
        .from('serp_jobs')
        .update({ progress_step: 'nlp' })
        .eq('id', jobId)

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

      // Step 4: Calculate benchmarks and save
      await supabase
        .from('serp_jobs')
        .update({ progress_step: 'saving' })
        .eq('id', jobId)

      // Calculate structural benchmarks
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

      // Build semantic terms for scoring
      const semanticTermsForScoring: SemanticTerm[] = nlpData.terms.map((t: any, i: number) => ({
        id: `temp-${i}`,
        serp_analysis_id: '',
        term: t.term,
        display_term: t.display_term,
        is_main_keyword: t.term.includes(keyword.toLowerCase()),
        min_occurrences: t.min_occurrences,
        max_occurrences: t.max_occurrences,
        importance: t.importance,
        term_type: t.term_type,
        is_to_avoid: false,
      }))

      // Calculate score for each SERP page
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

      // Calculate refresh interval
      const refreshIntervalMonths = 6
      const refreshDate = new Date()
      refreshDate.setMonth(refreshDate.getMonth() + refreshIntervalMonths)

      // Delete existing analysis for this guide
      await supabase.from('serp_analyses').delete().eq('guide_id', job.guide_id)

      // Insert SERP analysis
      const { data: analysis, error: analysisError } = await supabase
        .from('serp_analyses')
        .insert({
          guide_id: job.guide_id,
          keyword,
          language: lang,
          structural_benchmarks: structuralBenchmarks,
          refresh_interval_months: refreshIntervalMonths,
          refresh_recommended_at: refreshDate.toISOString(),
        })
        .select()
        .single()

      if (analysisError || !analysis) {
        throw new Error(`Failed to save analysis: ${analysisError?.message}`)
      }

      // Insert SERP pages
      const { data: savedPages, error: pagesError } = await supabase
        .from('serp_pages')
        .insert(serpPagesData.map(p => ({ ...p, serp_analysis_id: analysis.id })))
        .select()
        .order('position')

      if (pagesError || !savedPages) {
        throw new Error(`Failed to save SERP pages: ${pagesError?.message}`)
      }

      // Insert semantic terms
      const termsToInsert = [
        ...nlpData.terms.map((t: any) => ({
          serp_analysis_id: analysis.id,
          term: t.term,
          display_term: t.display_term,
          is_main_keyword: t.term.includes(keyword.toLowerCase()),
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
        throw new Error(`Failed to save terms: ${termsError?.message}`)
      }

      // Mark job as completed
      await supabase
        .from('serp_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      logger.info('SERP job completed successfully', {
        jobId,
        keyword,
        language: lang,
        duration: Date.now() - startTime,
        requestId,
      })

      return NextResponse.json({ success: true, jobId })

    } catch (error) {
      // Mark job as failed
      await supabase
        .from('serp_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_details: error instanceof Error ? { stack: error.stack } : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      logger.error('SERP job failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        requestId,
      })

      throw error
    }
  } catch (error) {
    return handleApiError(error, {
      route: '/api/serp/process-job',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
