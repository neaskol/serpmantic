import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { getModel } from '@/lib/ai/registry'
import { buildOutlinePrompt, validateOutlineHierarchy, parseOutlineResponse } from '@/lib/ai/outline-builder'
import { estimateCost } from '@/lib/ai/executor'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import type { ExtractedHeading, SemanticTerm } from '@/types/database'

// Prevent timeout for AI generation
export const maxDuration = 30

/**
 * Request validation schema
 */
const PlanRequestSchema = z.object({
  guideId: z.string().uuid(),
})

/**
 * POST /api/ai/plan
 *
 * Generate structured H2/H3 content outline using Claude Sonnet 4.5
 *
 * Flow:
 * 1. Authenticate user
 * 2. Load guide keyword and language
 * 3. Load SERP analysis data
 * 4. Load competitor pages with headings
 * 5. Load top semantic terms
 * 6. Build outline generation prompt
 * 7. Call Claude Sonnet 4.5 with generateText()
 * 8. Parse and validate JSON response
 * 9. Log token usage to database
 * 10. Return outline array
 *
 * @param request - NextRequest with JSON body { guideId }
 * @returns JSON response with { outline: OutlineSection[] }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    // Create Supabase client
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logger.warn('Unauthorized request', { route: '/api/ai/plan' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const { guideId } = PlanRequestSchema.parse(body)

    logger.info('Plan generation request received', {
      userId: user.id,
      guideId,
    })

    // Load guide
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .select('keyword, language')
      .eq('id', guideId)
      .single()

    if (guideError || !guide) {
      logger.warn('Guide not found', { guideId, error: guideError })
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Load SERP analysis
    const { data: serpAnalysis, error: serpError } = await supabase
      .from('serp_analyses')
      .select('id')
      .eq('guide_id', guideId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Handle SERP query errors
    if (serpError) {
      // Type guard for PostgrestError
      const pgError = serpError as { code?: string; message?: string }

      // PGRST116 = no rows found (expected if user hasn't run analysis)
      if (pgError.code === 'PGRST116' || !serpAnalysis) {
        logger.info('No SERP analysis found for guide', { guideId })
        return NextResponse.json(
          { error: 'No SERP analysis found. Run analysis first.' },
          { status: 400 }
        )
      }

      // Other errors are unexpected (DB connection, permissions, etc.)
      logger.error('SERP analysis query failed', {
        guideId,
        error: pgError.message || 'Unknown error',
        code: pgError.code,
      })
      return handleApiError(new Error(pgError.message || 'SERP query failed'), {
        route: '/api/ai/plan',
        context: { guideId },
      })
    }

    // Double-check serpAnalysis exists (type guard)
    if (!serpAnalysis) {
      logger.info('No SERP analysis found for guide', { guideId })
      return NextResponse.json(
        { error: 'No SERP analysis found. Run analysis first.' },
        { status: 400 }
      )
    }

    // Load SERP pages with headings
    const { data: serpPages, error: pagesError } = await supabase
      .from('serp_pages')
      .select('url, title, score, headings, is_excluded')
      .eq('serp_analysis_id', serpAnalysis.id)
      .returns<Array<{
        url: string
        title: string
        score: number
        headings: ExtractedHeading[]
        is_excluded: boolean
      }>>()

    if (pagesError) {
      logger.error('SERP pages query failed', {
        serpAnalysisId: serpAnalysis.id,
        error: pagesError.message,
      })
      return handleApiError(new Error(pagesError.message), {
        route: '/api/ai/plan',
        context: { guideId, serpAnalysisId: serpAnalysis.id },
      })
    }

    // Filter to non-excluded pages only
    const competitors = (serpPages || [])
      .filter((page) => !page.is_excluded)
      .map((page) => ({
        url: page.url,
        title: page.title,
        headings: page.headings || [],
      }))

    logger.debug('Loaded competitor pages', {
      total: serpPages?.length || 0,
      nonExcluded: competitors.length,
      withHeadings: competitors.filter((c) => c.headings.length > 2).length,
    })

    // Load semantic terms
    const { data: semanticTerms, error: termsError } = await supabase
      .from('semantic_terms')
      .select('display_term, importance, is_to_avoid')
      .eq('serp_analysis_id', serpAnalysis.id)
      .returns<SemanticTerm[]>()

    if (termsError) {
      logger.error('Semantic terms query failed', {
        serpAnalysisId: serpAnalysis.id,
        error: termsError.message,
      })
      return handleApiError(new Error(termsError.message), {
        route: '/api/ai/plan',
        context: { guideId, serpAnalysisId: serpAnalysis.id },
      })
    }

    // Filter to top 30 non-avoided terms
    const topTerms = (semanticTerms || [])
      .filter((term) => !term.is_to_avoid)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 30)
      .map((term) => term.display_term)

    logger.debug('Loaded semantic terms', {
      total: semanticTerms?.length || 0,
      nonAvoided: topTerms.length,
    })

    // Build prompt
    const prompt = buildOutlinePrompt(guide.keyword, competitors, topTerms)

    logger.info('Generating outline with Claude Sonnet 4.5', {
      keyword: guide.keyword,
      language: guide.language,
      promptLength: prompt.length,
    })

    // Call Claude Sonnet 4.5
    const result = await generateText({
      model: getModel('anthropic/claude-sonnet-4-5-20250929') as unknown as Parameters<typeof generateText>[0]['model'],
      system:
        'You are an expert SEO content strategist specializing in competitive SERP analysis. Generate structured H2/H3 outlines optimized for semantic coverage and search intent.',
      prompt,
    })

    logger.debug('Received outline response', {
      textLength: result.text.length,
      usage: result.usage,
    })

    // Parse and validate response
    let outline
    try {
      outline = parseOutlineResponse(result.text)
    } catch (error) {
      logger.error('Failed to parse outline response', {
        error: error instanceof Error ? error.message : String(error),
        responsePreview: result.text.slice(0, 200),
      })
      return NextResponse.json(
        { error: 'Generated outline was malformed. Please try again.' },
        { status: 500 }
      )
    }

    // Validate hierarchy
    const isValidHierarchy = validateOutlineHierarchy(outline)
    if (!isValidHierarchy) {
      logger.error('Outline has invalid hierarchy', {
        outlineLength: outline.length,
        firstLevel: outline[0]?.level,
      })
      return NextResponse.json(
        { error: 'Generated outline has invalid structure. Please try again.' },
        { status: 500 }
      )
    }

    logger.info('Outline generated successfully', {
      sectionCount: outline.length,
      h2Count: outline.filter((s) => s.level === 'h2').length,
      h3Count: outline.filter((s) => s.level === 'h3').length,
    })

    // Log to ai_requests table
    const modelId = 'anthropic/claude-sonnet-4-5-20250929'

    // Extract token usage - AI SDK v6 structure varies by model
    // Access properties dynamically to avoid TypeScript errors
    const usage: any = result.usage
    const promptTokens = Number(usage.promptTokens || usage.inputTokens || 0)
    const completionTokens = Number(usage.completionTokens || usage.outputTokens || 0)
    const totalTokens = Number(usage.totalTokens || (promptTokens + completionTokens))

    const cost = estimateCost(modelId, { promptTokens, completionTokens })

    const { error: insertError } = await supabase.from('ai_requests').insert({
      user_id: user.id,
      guide_id: guideId,
      prompt_id: null, // Outline generation is not prompt-based
      model_id: modelId,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: cost,
      finish_reason: result.finishReason,
    })

    if (insertError) {
      logger.error('Failed to record AI request', {
        error: insertError.message,
        userId: user.id,
        guideId,
      })
      // Don't throw - outline generated successfully
    }

    return NextResponse.json({ outline })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai/plan',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
