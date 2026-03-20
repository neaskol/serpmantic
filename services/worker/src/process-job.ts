import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Types
type CrawledPage = {
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

type SemanticTerm = {
  id: string
  serp_analysis_id: string
  term: string
  display_term: string
  is_main_keyword: boolean
  min_occurrences: number
  max_occurrences: number
  importance: number
  term_type: string
  is_to_avoid: boolean
}

type NlpResponse = {
  terms: Array<{
    term: string
    display_term: string
    min_occurrences: number
    max_occurrences: number
    importance: number
    term_type: string
  }>
  terms_to_avoid: string[]
}

// Helper: Fetch SERP results
async function fetchSerpResults(keyword: string, lang: string, engine: string) {
  // TODO: Implement actual SERP API call (ValueSerp, SerpApi, etc.)
  // For now, return mock data
  console.log(`[SERP] Fetching results for "${keyword}" (${lang}, ${engine})`)
  return [
    { link: 'https://example.com/1', title: 'Result 1' },
    { link: 'https://example.com/2', title: 'Result 2' },
    { link: 'https://example.com/3', title: 'Result 3' },
    { link: 'https://example.com/4', title: 'Result 4' },
    { link: 'https://example.com/5', title: 'Result 5' },
    { link: 'https://example.com/6', title: 'Result 6' },
  ]
}

// Helper: Crawl a page
async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    console.log(`[Crawler] Crawling ${url}`)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SERPmantics/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    })

    if (!response.ok) {
      console.warn(`[Crawler] HTTP ${response.status} for ${url}`)
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove noise
    $('script, style, nav, footer, header, aside, .cookie-banner, #cookie-notice').remove()

    const title = $('h1').first().text().trim() || $('title').text().trim()
    const text = $('body').text().replace(/\s+/g, ' ').trim()

    const metrics = {
      words: text.split(/\s+/).length,
      headings: $('h1, h2, h3, h4, h5, h6').length,
      paragraphs: $('p').length,
      links: $('a[href]').length,
      images: $('img').length,
      videos: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      tables: $('table').length,
      lists: $('ul, ol').length,
    }

    return { url, title, text, metrics }
  } catch (error) {
    console.warn(`[Crawler] Failed to crawl ${url}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

// Helper: Calculate score
function calculateScore(text: string, terms: SemanticTerm[]) {
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const termStatuses = terms.map(term => {
    const regex = new RegExp(`\\b${term.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = normalizedText.match(regex)
    const count = matches ? matches.length : 0

    return {
      term,
      count,
      inRange: count >= term.min_occurrences && count <= term.max_occurrences
    }
  })

  // Simple scoring: percentage of terms in range
  const inRangeCount = termStatuses.filter(ts => ts.inRange).length
  const score = Math.round((inRangeCount / Math.max(terms.length, 1)) * 120)

  return { score, termStatuses }
}

// Main job processing function
export async function processJob(jobId: string) {
  const startTime = Date.now()
  console.log(`[Worker] Starting job ${jobId}`)

  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('serp_jobs')
      .select('*, guides!inner(keyword, language, search_engine)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`)
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

    // Step 1: Fetch SERP results
    console.log(`[Worker] Fetching SERP results for "${keyword}"`)
    const serpResults = await fetchSerpResults(keyword, lang, engine)
    const limitedResults = serpResults.slice(0, 10) // Full 10 pages - no timeout here!

    if (limitedResults.length === 0) {
      throw new Error('No SERP results found')
    }

    // Step 2: Crawl pages
    await supabase
      .from('serp_jobs')
      .update({ progress_step: 'crawling' })
      .eq('id', jobId)

    console.log(`[Worker] Crawling ${limitedResults.length} pages`)
    const crawlPromises = limitedResults.map(r => crawlPage(r.link))
    const crawledPages = (await Promise.all(crawlPromises)).filter(Boolean) as CrawledPage[]

    if (crawledPages.length < 2) {
      throw new Error('Not enough pages could be crawled')
    }

    console.log(`[Worker] Crawled ${crawledPages.length}/${limitedResults.length} pages successfully`)

    // Step 3: NLP analysis
    await supabase
      .from('serp_jobs')
      .update({ progress_step: 'nlp' })
      .eq('id', jobId)

    console.log(`[Worker] Calling NLP service`)
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

    const nlpData = await nlpResponse.json() as NlpResponse
    console.log(`[Worker] NLP completed in ${Date.now() - nlpStartTime}ms - ${nlpData.terms?.length || 0} terms found`)

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

    console.log(`[Worker] Job ${jobId} completed successfully in ${Date.now() - startTime}ms`)

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

    console.error(`[Worker] Job ${jobId} failed:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}
