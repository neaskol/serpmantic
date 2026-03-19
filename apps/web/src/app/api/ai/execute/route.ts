import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { executePrompt, estimateCost } from '@/lib/ai/executor'
import { getModelForTask } from '@/lib/ai/router'
import type { TaskType } from '@/lib/ai/router'
import { buildPromptContext, buildPrompt, buildSystemMessage } from '@/lib/ai/context-builder'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'
import type { Prompt, SerpAnalysis, SemanticTerm } from '@/types/database'

// CRITICAL: Without this, Next.js serverless functions timeout after 10s
export const maxDuration = 30

/**
 * Request validation schema
 */
const ExecuteRequestSchema = z.object({
  promptId: z.string().uuid(),
  guideId: z.string().uuid(),
  selectedText: z.string().optional(),
  scope: z.enum(['selection', 'document']).default('document'),
})

/**
 * POST /api/ai/execute
 *
 * Execute an AI prompt with streaming response
 *
 * Flow:
 * 1. Authenticate user
 * 2. Load prompt template from database
 * 3. Load guide + SERP analysis for context
 * 4. Enrich prompt with SERP semantic data
 * 5. Route to correct LLM model
 * 6. Stream response to client
 * 7. Track token usage in database
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
      logger.warn('Unauthorized request', { route: '/api/ai/execute' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body: unknown = await request.json()
    const { promptId, guideId, selectedText, scope } = ExecuteRequestSchema.parse(body)

    logger.info('AI execution request received', {
      userId: user.id,
      promptId,
      guideId,
      scope,
      hasSelectedText: !!selectedText,
    })

    // Load prompt from database
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .single<Prompt>()

    if (promptError || !prompt) {
      logger.warn('Prompt not found', { promptId, error: promptError })
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Load guide with SERP context
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .select('keyword, language, content, prompt_context, active_context_id')
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

    // Load semantic terms for SERP analysis
    const { data: semanticTerms } = await supabase
      .from('semantic_terms')
      .select('*')
      .eq('serp_analysis_id', serpAnalysis?.id || '')
      .returns<SemanticTerm[]>()

    logger.debug('Context loaded', {
      hasSerp: !!serpAnalysis,
      termCount: semanticTerms?.length || 0,
    })

    // Resolve user context: prefer FK reference, fall back to inline JSONB
    let userContext = guide.prompt_context || undefined
    if (guide.active_context_id) {
      const { data: ctx } = await supabase
        .from('prompt_contexts')
        .select('audience, tone, sector, brief')
        .eq('id', guide.active_context_id)
        .single()
      if (ctx) {
        userContext = {
          audience: ctx.audience || undefined,
          tone: ctx.tone || undefined,
          sector: ctx.sector || undefined,
          brief: ctx.brief || undefined,
        }
      }
    }

    logger.debug('Context resolved', {
      hasActiveContextId: !!guide.active_context_id,
      hasFallbackContext: !!guide.prompt_context,
      resolvedFields: userContext ? Object.keys(userContext).filter(k => userContext[k as keyof typeof userContext]) : [],
    })

    // Build prompt context from SERP data
    const promptContext = buildPromptContext(
      serpAnalysis || null,
      semanticTerms || [],
      { keyword: guide.keyword, language: guide.language },
      {
        selectedText,
        currentContent: guide.content ? JSON.stringify(guide.content) : '',
        userContext,
      }
    )

    // Determine which model to use
    const modelId = prompt.model_id || getModelForTask(prompt.task_type as TaskType)

    // Build enriched prompt by replacing template variables
    const enrichedPrompt = buildPrompt(prompt.prompt_template, promptContext)

    // Build system prompt
    const systemPrompt = prompt.system_prompt || buildSystemMessage(prompt.task_type, promptContext)

    logger.info('Executing AI prompt', {
      modelId,
      taskType: prompt.task_type,
      promptLength: enrichedPrompt.length,
      systemPromptLength: systemPrompt.length,
    })

    // Execute prompt with streaming, passing onFinish callback for DB writes
    const result = await executePrompt({
      modelId,
      prompt: enrichedPrompt,
      systemPrompt,
      maxTokens: 4096,
      onFinish: async ({ usage, finishReason }) => {
        // This runs AFTER the stream completes
        // Supabase client and user are captured in closure
        const cost = estimateCost(modelId, usage)

        logger.info('Recording AI request to database', {
          userId: user.id,
          guideId,
          promptId,
          totalTokens: usage.totalTokens,
          estimatedCost: cost,
        })

        const { error: insertError } = await supabase.from('ai_requests').insert({
          user_id: user.id,
          guide_id: guideId,
          prompt_id: promptId,
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
      route: '/api/ai/execute',
      context: { requestId },
    })
  } finally {
    logger.clearRequestId()
  }
}
