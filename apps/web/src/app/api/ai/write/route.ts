import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { executePrompt, estimateCost } from '@/lib/ai/executor'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import type { SerpAnalysis, SemanticTerm } from '@/types/database'

// Article writing takes longer than other AI endpoints
export const maxDuration = 60

/**
 * Request validation schema
 */
const WriteRequestSchema = z.object({
  guideId: z.string().uuid(),
  modelId: z.string().min(1),
  mode: z.enum(['full', 'section', 'optimize']),
  sectionIndex: z.number().int().min(0).optional(),
  sectionHeading: z.string().optional(),
  sectionContent: z.string().optional(),
  currentContent: z.string().optional(),
})

/**
 * Build the shared system prompt for all writing modes
 */
function buildSystemPrompt(
  keyword: string,
  language: string,
  termsToAvoid: string[]
): string {
  return [
    'You are an expert SEO content writer.',
    `Target keyword: "${keyword}".`,
    `Language: ${language}.`,
    '',
    'Rules:',
    '- Write in HTML format using h2, h3, p, ul, li, strong, em tags.',
    '- Keep existing headings exactly as provided (do not rename or reorder them).',
    '- Integrate semantic terms naturally into the text.',
    '- Content must sound human, not AI-generated.',
    '- Aim for the middle of the occurrence ranges for each semantic term.',
    '- Do NOT add an H1 title.',
    '',
    termsToAvoid.length > 0
      ? `Terms to AVOID (do not use these): ${termsToAvoid.join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Build user prompt for "full" mode: generate complete article from headings
 */
function buildFullModePrompt(
  currentContent: string,
  terms: SemanticTerm[],
  wordRange: { min: number; max: number }
): string {
  // Extract H2/H3 headings from the current content
  const headingRegex = /<(h[2-3])[^>]*>(.*?)<\/\1>/gi
  const headings: string[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(currentContent)) !== null) {
    const tag = match[1].toLowerCase()
    const text = match[2].replace(/<[^>]*>/g, '').trim()
    headings.push(`<${tag}>${text}</${tag}>`)
  }

  // Top 40 semantic terms sorted by importance
  const topTerms = terms
    .filter((t) => !t.is_to_avoid)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 40)

  const termsList = topTerms
    .map((t) => `- "${t.display_term}" (${t.min_occurrences}-${t.max_occurrences} occurrences)`)
    .join('\n')

  return [
    'Write a complete article in HTML using the following heading structure:',
    '',
    headings.join('\n'),
    '',
    `Target word count: ${wordRange.min}-${wordRange.max} words.`,
    '',
    'Semantic terms to integrate (with target occurrence ranges):',
    termsList,
    '',
    'Return only the HTML content (from the first <h2> to the end). Do not wrap in ```html blocks.',
  ].join('\n')
}

/**
 * Build user prompt for "section" mode: rewrite a single section
 */
function buildSectionModePrompt(
  sectionHeading: string,
  sectionContent: string,
  terms: SemanticTerm[]
): string {
  // Top 15 semantic terms sorted by importance
  const topTerms = terms
    .filter((t) => !t.is_to_avoid)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15)

  const termsList = topTerms
    .map((t) => `- "${t.display_term}" (${t.min_occurrences}-${t.max_occurrences} occurrences)`)
    .join('\n')

  return [
    `Rewrite only this section. Keep the heading exactly as-is: "${sectionHeading}".`,
    '',
    'Current section content:',
    sectionContent,
    '',
    'Semantic terms to integrate (with target occurrence ranges):',
    termsList,
    '',
    'Return only the HTML for this section (heading + body). Do not wrap in ```html blocks.',
  ].join('\n')
}

/**
 * Build user prompt for "optimize" mode: improve existing content toward score 75-85
 */
function buildOptimizeModePrompt(
  currentContent: string,
  terms: SemanticTerm[]
): string {
  // Top 20 missing/underused terms sorted by importance
  const missingTerms = terms
    .filter((t) => !t.is_to_avoid)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20)

  const termsList = missingTerms
    .map((t) => `- "${t.display_term}" (${t.min_occurrences}-${t.max_occurrences} occurrences)`)
    .join('\n')

  return [
    'Optimize the following article to reach a semantic score of 75-85.',
    'Preserve the existing structure (headings, paragraphs). Only modify passages to better integrate the missing semantic terms.',
    '',
    'Current content:',
    currentContent,
    '',
    'Missing semantic terms to add (with target occurrence ranges):',
    termsList,
    '',
    'Return the full optimized HTML. Do not wrap in ```html blocks.',
  ].join('\n')
}

/**
 * POST /api/ai/write
 *
 * AI article writing with 3 modes: full article, section regeneration, and optimization.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request (Zod)
 * 3. Load guide, SERP analysis, and semantic terms
 * 4. Build system + user prompt based on mode
 * 5. Execute via streaming LLM
 * 6. Log token usage to ai_requests table
 * 7. Return streaming response
 *
 * @param request - NextRequest with JSON body
 * @returns Streaming text response
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
      logger.warn('Unauthorized request', { route: '/api/ai/write' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const {
      guideId,
      modelId,
      mode,
      sectionHeading,
      sectionContent,
      currentContent,
    } = WriteRequestSchema.parse(body)

    logger.info('AI write request received', {
      userId: user.id,
      guideId,
      modelId,
      mode,
      hasSectionHeading: !!sectionHeading,
      hasCurrentContent: !!currentContent,
    })

    // Load guide
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .select('keyword, language, content, active_context_id, prompt_context')
      .eq('id', guideId)
      .single()

    if (guideError || !guide) {
      logger.warn('Guide not found', { guideId, error: guideError })
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Load SERP analysis (most recent)
    const { data: serpAnalysis } = await supabase
      .from('serp_analyses')
      .select('*')
      .eq('guide_id', guideId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single<SerpAnalysis>()

    if (!serpAnalysis) {
      logger.warn('No SERP analysis found', { guideId })
      return NextResponse.json(
        { error: 'No SERP analysis found. Run analysis first.' },
        { status: 400 }
      )
    }

    // Load semantic terms for SERP analysis
    const { data: semanticTerms } = await supabase
      .from('semantic_terms')
      .select('*')
      .eq('serp_analysis_id', serpAnalysis.id)
      .returns<SemanticTerm[]>()

    const terms = semanticTerms || []

    logger.debug('Context loaded', {
      hasSerp: !!serpAnalysis,
      termCount: terms.length,
    })

    // Collect terms to avoid
    const termsToAvoid = terms
      .filter((t) => t.is_to_avoid)
      .map((t) => t.display_term)

    // Build system prompt (shared across all modes)
    const systemPrompt = buildSystemPrompt(guide.keyword, guide.language, termsToAvoid)

    // Build user prompt based on mode
    let userPrompt: string

    switch (mode) {
      case 'full': {
        if (!currentContent) {
          return NextResponse.json(
            { error: 'currentContent is required for full mode.' },
            { status: 400 }
          )
        }

        // Check that headings exist
        const headingRegex = /<(h[2-3])[^>]*>(.*?)<\/\1>/gi
        if (!headingRegex.test(currentContent)) {
          return NextResponse.json(
            { error: 'No H2/H3 headings found in content. Generate a plan first.' },
            { status: 400 }
          )
        }

        const wordRange = serpAnalysis.structural_benchmarks?.words || { min: 800, max: 2000 }
        userPrompt = buildFullModePrompt(currentContent, terms, wordRange)
        break
      }

      case 'section': {
        if (!sectionHeading || !sectionContent) {
          return NextResponse.json(
            { error: 'sectionHeading and sectionContent are required for section mode.' },
            { status: 400 }
          )
        }

        userPrompt = buildSectionModePrompt(sectionHeading, sectionContent, terms)
        break
      }

      case 'optimize': {
        if (!currentContent) {
          return NextResponse.json(
            { error: 'currentContent is required for optimize mode.' },
            { status: 400 }
          )
        }

        userPrompt = buildOptimizeModePrompt(currentContent, terms)
        break
      }
    }

    logger.info('Executing AI write', {
      modelId,
      mode,
      promptLength: userPrompt.length,
      systemPromptLength: systemPrompt.length,
      termCount: terms.length,
    })

    // Execute prompt with streaming, passing onFinish callback for DB writes
    const result = await executePrompt({
      modelId,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 8192,
      onFinish: async ({ usage, finishReason }) => {
        // This runs AFTER the stream completes
        const cost = estimateCost(modelId, usage)

        logger.info('Recording AI write request to database', {
          userId: user.id,
          guideId,
          mode,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
        })

        const { error: insertError } = await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: guideId,
          prompt_id: null, // Article writing is not prompt-based
          model_id: modelId,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          estimated_cost: cost,
          finish_reason: finishReason,
        })

        if (insertError) {
          logger.error('Failed to record AI write request', {
            error: insertError.message,
            userId: user.id,
            guideId,
          })
          // Don't throw - stream completed successfully
        }
      },
    })

    // Return streaming text response
    // IMPORTANT: Use toTextStreamResponse() for raw text, NOT toUIMessageStreamResponse()
    return result.toTextStreamResponse()
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai/write',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
