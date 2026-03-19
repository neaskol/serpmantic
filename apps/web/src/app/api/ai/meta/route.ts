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
  content: z.string().min(10, 'Content required for meta generation'),
})

type MetaSuggestion = {
  title: string
  description: string
}

/**
 * POST /api/ai/meta
 *
 * Generate AI-powered meta tag suggestions (title + description)
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request (keyword, language, content preview)
 * 3. Call GPT-4o Mini with SEO meta tag prompt
 * 4. Parse JSON response (extract title/description variants)
 * 5. Validate character counts (filter invalid suggestions)
 * 6. Track token usage in database
 * 7. Return 2-3 validated suggestions
 *
 * @param request - NextRequest with JSON body
 * @returns JSON response with suggestions array
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
      logger.warn('Unauthorized request', { route: '/api/ai/meta' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const { keyword, language, content } = RequestSchema.parse(body)

    logger.info('Meta generation request received', {
      userId: user.id,
      keyword,
      language,
      contentLength: content.length,
    })

    // Determine model to use (GPT-4o Mini for cost efficiency)
    const modelId = getModelForTask('meta_generation')

    // Build system prompt
    const systemPrompt =
      "You are an expert SEO copywriter specializing in meta tags. You understand character limits are STRICT - never exceed them. Your meta tags achieve high CTR while staying within Google's display limits. Always return valid JSON without markdown code blocks."

    // Build user prompt
    const userPrompt = `Generate 3 optimized SEO meta tag variants for this content.

Target Keyword: "${keyword}"
Language: ${language}

Content Preview:
${content.slice(0, 1500)}

Requirements:
- Title: EXACTLY 51-55 characters (count carefully, NEVER exceed 60)
- Description: EXACTLY 120-155 characters (NEVER exceed 158)
- Include the keyword "${keyword}" naturally in both title and description
- Make titles compelling and click-worthy
- Make descriptions action-oriented with clear value proposition
- Match the content's intent and tone

Character counting example: "Example Title Here" = 18 characters

Return ONLY valid JSON with 3 variants:
{
  "suggestions": [
    {
      "title": "Your 53-char title here",
      "description": "Your 140-char description here that is compelling and includes the keyword."
    }
  ]
}`

    logger.info('Executing meta generation prompt', {
      modelId,
      promptLength: userPrompt.length,
    })

    // Execute prompt (non-streaming, get full text)
    const result = await executePrompt({
      modelId,
      prompt: userPrompt,
      systemPrompt,
      onFinish: async ({ usage, finishReason }) => {
        // Log to ai_requests table (prompt_id is null for meta generation)
        const cost = estimateCost(modelId, usage)

        logger.info('Recording meta generation request', {
          userId: user.id,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
        })

        const { error: insertError } = await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: null, // Meta generation not tied to specific guide request
          prompt_id: null, // No prompt template used
          model_id: modelId,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          estimated_cost: cost,
          finish_reason: finishReason,
        })

        if (insertError) {
          logger.error('Failed to record meta generation request', {
            error: insertError.message,
            userId: user.id,
          })
          // Don't throw - execution completed successfully
        }
      },
    })

    // Get full text from result
    const responseText = await result.text

    logger.debug('AI response received', {
      textLength: responseText.length,
    })

    // Parse JSON from response (handles markdown wrapping)
    const parsed = extractJSON(responseText) as { suggestions?: MetaSuggestion[] }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      logger.error('Invalid AI response structure', { parsed })
      return NextResponse.json(
        { error: 'AI generated invalid response format. Please try again.' },
        { status: 500 }
      )
    }

    // Validate suggestions - filter out those exceeding hard limits
    const validSuggestions = parsed.suggestions.filter((s: MetaSuggestion) => {
      const titleValid = typeof s.title === 'string' && s.title.length >= 30 && s.title.length <= 70
      const descValid = typeof s.description === 'string' && s.description.length >= 80 && s.description.length <= 200

      if (!titleValid || !descValid) {
        logger.warn('Filtered invalid suggestion', {
          titleLength: s.title?.length,
          descLength: s.description?.length,
        })
      }

      return titleValid && descValid
    })

    if (validSuggestions.length === 0) {
      logger.error('No valid suggestions after filtering', {
        originalCount: parsed.suggestions.length,
      })
      return NextResponse.json(
        { error: 'AI generated invalid meta tags. Please try again.' },
        { status: 500 }
      )
    }

    logger.info('Meta generation successful', {
      suggestionsCount: validSuggestions.length,
    })

    return NextResponse.json({ suggestions: validSuggestions })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai/meta',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
