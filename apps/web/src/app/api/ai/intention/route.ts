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
  serpPages: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
      })
    )
    .min(3, 'At least 3 SERP pages required for intent analysis'),
})

/**
 * POST /api/ai/intention
 *
 * Analyze search intent for a keyword based on SERP results
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request (keyword, language, serpPages)
 * 3. Build SERP context from page titles + URLs
 * 4. Call Claude to classify intent (4-way: informationnel, transactionnel, navigationnel, comparatif)
 * 5. Parse JSON response with extractJSON utility
 * 6. Log usage to ai_requests table
 * 7. Return intent classification
 *
 * @param request - NextRequest with JSON body
 * @returns JSON with primaryIntent, confidence, and intents array
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
      logger.warn('Unauthorized request', { route: '/api/ai/intention' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const { keyword, language, serpPages } = RequestSchema.parse(body)

    logger.info('Intent analysis request received', {
      userId: user.id,
      keyword,
      language,
      serpPageCount: serpPages.length,
    })

    // Build SERP context string (numbered list with title + URL)
    const serpContext = serpPages
      .map((page, i) => `${i + 1}. ${page.title}\n   URL: ${page.url}`)
      .join('\n\n')

    // Determine response language instruction
    const languageInstruction = language.startsWith('fr')
      ? 'Réponds en français. Les descriptions et questions doivent être en français.'
      : language.startsWith('es')
      ? 'Responde en español. Las descripciones y preguntas deben estar en español.'
      : language.startsWith('it')
      ? 'Rispondi in italiano. Le descrizioni e le domande devono essere in italiano.'
      : language.startsWith('de')
      ? 'Antworte auf Deutsch. Die Beschreibungen und Fragen müssen auf Deutsch sein.'
      : 'Respond in English. Descriptions and questions must be in English.'

    // Build prompt for intent classification
    const prompt = `Analyze the search intent for the keyword: "${keyword}"

Based on these top Google results:
${serpContext}

Classify the search intent. For each of these 4 intent types, provide a percentage (must sum to 100%), a description, and 2-3 example user questions:

1. Informationnel - User wants to learn, understand, or find information
2. Transactionnel - User wants to buy, subscribe, download, or take action
3. Navigationnel - User wants to find a specific website or page
4. Comparatif - User is researching/comparing before purchase

${languageInstruction}

Return ONLY valid JSON (no markdown, no explanation):
{
  "primaryIntent": "informationnel",
  "confidence": 85,
  "intents": [
    {
      "type": "informationnel",
      "percentage": 70,
      "description": "Les utilisateurs veulent comprendre...",
      "questions": ["Qu'est-ce que X ?", "Comment fonctionne X ?"]
    }
  ]
}`

    const systemPrompt =
      'You are an expert SEO analyst specializing in search intent classification. Analyze SERP data to determine user intent. Always return valid JSON without markdown code blocks.'

    // Determine which model to use (Claude Sonnet 4 for intent analysis)
    const modelId = getModelForTask('intent_analysis')

    logger.info('Executing intent analysis', {
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

        logger.info('Recording intent analysis request', {
          userId: user.id,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
        })

        const { error: insertError } = await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: null, // Intent analysis not tied to specific guide
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

    logger.debug('Intent analysis response received', {
      textLength: responseText.length,
    })

    // Parse JSON from response (handles markdown wrapping, extra text)
    const parsed = extractJSON(responseText)

    logger.info('Intent analysis completed', {
      userId: user.id,
      keyword,
    })

    // Return parsed intent classification
    return NextResponse.json(parsed)
  } catch (error) {
    return handleApiError(error, {
      route: '/api/ai/intention',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
