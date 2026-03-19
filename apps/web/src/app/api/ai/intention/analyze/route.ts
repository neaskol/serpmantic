import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { executePrompt, estimateCost } from '@/lib/ai/executor'
import { getModelForTask } from '@/lib/ai/router'
import { extractJSON } from '@/lib/ai/json-extractor'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

// CRITICAL: Without this, Next.js serverless functions timeout after 10s
export const maxDuration = 30

/**
 * Request validation schema
 */
const RequestSchema = z.object({
  keyword: z.string().min(1),
  language: z.string(),
  content: z.string().min(50, 'Content must be at least 50 characters'),
  intents: z
    .array(z.enum(['informationnel', 'transactionnel', 'navigationnel', 'comparatif']))
    .min(1),
})

/**
 * Intent descriptions for prompt context
 */
const INTENT_DESCRIPTIONS: Record<string, string> = {
  informationnel: 'educational content, explanations, how-to guides, FAQs',
  transactionnel: 'pricing, CTAs, buy buttons, checkout process',
  navigationnel: 'site navigation, contact info, about pages',
  comparatif: 'comparison tables, pros/cons, "vs" content, alternatives',
}

/**
 * POST /api/ai/intention/analyze
 *
 * Analyze content-intent alignment for a guide
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request (keyword, language, content, intents)
 * 3. Build intent descriptions from identified intents
 * 4. Call Claude to analyze content against intents
 * 5. Parse JSON response with extractJSON utility
 * 6. Log usage to ai_requests table
 * 7. Return alignment analysis with matched/missing intents and suggestions
 *
 * @param request - NextRequest with JSON body
 * @returns JSON with coversIntents, matchedIntents, missingIntents, suggestions
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
      logger.warn('Unauthorized request', { route: '/api/ai/intention/analyze' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const { keyword, language, content, intents } = RequestSchema.parse(body)

    logger.info('Content-intent analysis request received', {
      userId: user.id,
      keyword,
      language,
      contentLength: content.length,
      intentCount: intents.length,
    })

    // Truncate content to first 2000 chars for analysis
    const truncatedContent = content.slice(0, 2000)

    // Build intent descriptions for prompt
    const intentContext = intents
      .map((intent) => `- ${intent}: ${INTENT_DESCRIPTIONS[intent]}`)
      .join('\n')

    // Build prompt for content-intent alignment analysis
    const prompt = `Analyze this content for the keyword "${keyword}" and determine if it covers the identified search intents.

Content (truncated to 2000 chars):
"""
${truncatedContent}
"""

Identified search intents:
${intentContext}

Analyze:
1. Which intents are covered (clearly present in the content)?
2. Which intents are missing (not addressed)?
3. Provide 3-5 specific, actionable suggestions to improve intent coverage

Return ONLY valid JSON (no markdown, no explanation):
{
  "coversIntents": true,
  "matchedIntents": ["informationnel"],
  "missingIntents": ["comparatif"],
  "suggestions": [
    "Add a comparison table showing X vs Y",
    "Include pricing information with clear CTAs",
    "Add FAQ section to address common questions"
  ]
}`

    const systemPrompt =
      'You are an expert SEO content analyst. Analyze content-intent alignment and provide actionable suggestions. Always return valid JSON without markdown code blocks.'

    // Determine which model to use (Claude Sonnet 4 for intent analysis)
    const modelId = getModelForTask('intent_analysis')

    logger.info('Executing content-intent analysis', {
      modelId,
      promptLength: prompt.length,
    })

    // Execute prompt (non-streaming - we need full response to parse JSON)
    const result = await executePrompt({
      modelId,
      prompt,
      systemPrompt,
      onFinish: async ({ usage, finishReason }) => {
        // Log to ai_requests table (prompt_id is null since this isn't prompt-based)
        const cost = estimateCost(modelId, usage)

        logger.info('Recording content-intent analysis request', {
          userId: user.id,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
        })

        const { error: insertError } = await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: null, // Content analysis not tied to specific guide
          prompt_id: null, // Not a prompt-based execution
          model_id: modelId,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          estimated_cost: cost,
          finish_reason: finishReason,
        })

        if (insertError) {
          logger.error('Failed to record AI request', {
            error: insertError.message,
            userId: user.id,
          })
          // Don't throw - analysis completed successfully
        }
      },
    })

    // Get full text response (not streaming)
    const responseText = await result.text

    logger.debug('Content-intent analysis response received', {
      textLength: responseText.length,
    })

    // Parse JSON from response (handles markdown wrapping, extra text)
    const parsed = extractJSON(responseText)

    logger.info('Content-intent analysis completed', {
      userId: user.id,
      keyword,
    })

    // Return parsed content-intent alignment analysis
    return NextResponse.json(parsed)
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai/intention/analyze',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
