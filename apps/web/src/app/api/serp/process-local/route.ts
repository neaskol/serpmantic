import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * LOCAL TESTING ENDPOINT
 * Simulates worker behavior to test if data persistence works
 * This creates fake SERP data directly in the database
 */
export async function POST(request: NextRequest) {
  try {
    const { guideId } = await request.json()

    if (!guideId) {
      return NextResponse.json({ error: 'guideId required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get or create guide
    let { data: guide, error: guideError } = await supabase
      .from('guides')
      .select('keyword, language, user_id')
      .eq('id', guideId)
      .single()

    // If guide doesn't exist, create it
    if (guideError || !guide) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: newGuide, error: createError } = await supabase
        .from('guides')
        .insert({
          id: guideId,
          user_id: user.id,
          keyword: 'Test Keyword',
          language: 'fr',
          search_engine: 'google.fr',
        })
        .select('keyword, language, user_id')
        .single()

      if (createError || !newGuide) {
        return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 })
      }
      guide = newGuide
    }

    console.log('[Local Worker] Creating fake SERP data for guide:', guideId)

    // Delete existing analysis
    await supabase.from('serp_analyses').delete().eq('guide_id', guideId)

    // Create fake structural benchmarks
    const structuralBenchmarks = {
      words: { min: 500, max: 1500 },
      headings: { min: 5, max: 15 },
      paragraphs: { min: 10, max: 30 },
      links: { min: 5, max: 20 },
      images: { min: 2, max: 8 },
      videos: { min: 0, max: 2 },
      tables: { min: 0, max: 2 },
      lists: { min: 2, max: 8 },
    }

    // Insert SERP analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('serp_analyses')
      .insert({
        guide_id: guideId,
        keyword: guide.keyword,
        language: guide.language,
        structural_benchmarks: structuralBenchmarks,
        refresh_interval_months: 6,
        refresh_recommended_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (analysisError || !analysis) {
      console.error('[Local Worker] Failed to create analysis:', analysisError)
      return NextResponse.json(
        { error: 'Failed to create analysis', details: analysisError },
        { status: 500 }
      )
    }

    console.log('[Local Worker] Analysis created:', analysis.id)

    // Insert fake SERP pages
    const fakePages = [
      {
        serp_analysis_id: analysis.id,
        url: 'https://example.com/page1',
        title: 'Page 1 - ' + guide.keyword,
        score: 100,
        is_excluded: false,
        metrics: {
          words: 1200,
          headings: 12,
          paragraphs: 25,
          links: 15,
          images: 5,
          videos: 1,
          tables: 1,
          lists: 6,
        },
        term_occurrences: {},
        position: 1,
      },
      {
        serp_analysis_id: analysis.id,
        url: 'https://example.com/page2',
        title: 'Page 2 - ' + guide.keyword,
        score: 85,
        is_excluded: false,
        metrics: {
          words: 900,
          headings: 8,
          paragraphs: 18,
          links: 10,
          images: 3,
          videos: 0,
          tables: 0,
          lists: 4,
        },
        term_occurrences: {},
        position: 2,
      },
    ]

    const { data: savedPages, error: pagesError } = await supabase
      .from('serp_pages')
      .insert(fakePages)
      .select()

    if (pagesError) {
      console.error('[Local Worker] Failed to create pages:', pagesError)
      return NextResponse.json(
        { error: 'Failed to create pages', details: pagesError },
        { status: 500 }
      )
    }

    console.log('[Local Worker] Pages created:', savedPages?.length)

    // Insert fake semantic terms
    const fakeTerms = [
      {
        serp_analysis_id: analysis.id,
        term: guide.keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        display_term: guide.keyword,
        is_main_keyword: true,
        min_occurrences: 3,
        max_occurrences: 8,
        importance: 1.0,
        term_type: 'phrase',
        is_to_avoid: false,
      },
      {
        serp_analysis_id: analysis.id,
        term: 'test',
        display_term: 'test',
        is_main_keyword: false,
        min_occurrences: 2,
        max_occurrences: 5,
        importance: 0.5,
        term_type: 'unigram',
        is_to_avoid: false,
      },
      {
        serp_analysis_id: analysis.id,
        term: 'exemple',
        display_term: 'exemple',
        is_main_keyword: false,
        min_occurrences: 1,
        max_occurrences: 3,
        importance: 0.3,
        term_type: 'unigram',
        is_to_avoid: false,
      },
    ]

    const { data: savedTerms, error: termsError } = await supabase
      .from('semantic_terms')
      .insert(fakeTerms)
      .select()

    if (termsError) {
      console.error('[Local Worker] Failed to create terms:', termsError)
      return NextResponse.json(
        { error: 'Failed to create terms', details: termsError },
        { status: 500 }
      )
    }

    console.log('[Local Worker] Terms created:', savedTerms?.length)

    return NextResponse.json({
      success: true,
      message: 'Fake SERP data created successfully',
      analysisId: analysis.id,
      pagesCount: savedPages?.length || 0,
      termsCount: savedTerms?.length || 0,
    })
  } catch (error) {
    console.error('[Local Worker] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
