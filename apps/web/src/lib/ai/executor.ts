import { streamText } from 'ai'
import { getModel } from './registry'
import { logger } from '@/lib/logger'

/**
 * Options for executing an AI prompt with streaming
 */
export interface ExecuteOptions {
  /** Full model ID like 'anthropic/claude-sonnet-4-20250514' */
  modelId: string
  /** The enriched user prompt */
  prompt: string
  /** Optional system prompt (overrides default) */
  systemPrompt?: string
  /** Max tokens to generate (default: 4096) */
  maxTokens?: number
  /** Callback invoked after stream completes (for DB writes, etc.) */
  onFinish?: (event: {
    text: string
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    finishReason: string
  }) => void | Promise<void>
}

/**
 * Result type from executePrompt - the streamText result object
 */
export type ExecuteResult = Awaited<ReturnType<typeof streamText>>

/**
 * Model pricing per million tokens (input, output)
 * Source: Provider pricing pages as of 2026-03
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
}

/**
 * Execute an AI prompt with streaming response
 *
 * This is the core execution primitive for all AI operations in the app.
 * It resolves the model, calls the AI SDK's streamText, and returns the
 * stream result. The caller (typically a route handler) uses
 * `.toTextStreamResponse()` to send the stream to the client.
 *
 * The onFinish callback allows the route handler to inject post-stream logic
 * (e.g., writing token usage to the database) while keeping the executor
 * generic and reusable.
 *
 * @param options - Execution options including model, prompt, and callbacks
 * @returns Stream result object (call .toTextStreamResponse() to send to client)
 *
 * @example
 * ```typescript
 * const result = await executePrompt({
 *   modelId: 'openai/gpt-4o-mini',
 *   prompt: enrichedPrompt,
 *   systemPrompt: systemMessage,
 *   onFinish: async ({ usage }) => {
 *     await db.logUsage(usage)
 *   }
 * })
 * return result.toTextStreamResponse()
 * ```
 */
export async function executePrompt(options: ExecuteOptions): Promise<ExecuteResult> {
  const { modelId, prompt, systemPrompt, maxTokens = 4096, onFinish } = options

  // Resolve the model from registry
  const model = getModel(modelId)

  logger.info('Starting AI prompt execution', {
    modelId,
    hasSystemPrompt: !!systemPrompt,
    maxTokens,
    promptLength: prompt.length,
  })

  // Execute streaming text generation
  // Type cast needed: AI SDK v5 providers return v3 models, but streamText accepts v2|v3
  // Note: maxTokens parameter removed in favor of model-specific settings
  const result = await streamText({
    model: model as unknown as Parameters<typeof streamText>[0]['model'],
    system: systemPrompt,
    prompt,
    async onFinish({ text, usage, finishReason }) {
      // Log completion info
      // Extract token usage - access dynamically to handle varying SDK versions
      const usageAny: any = usage
      const promptTokens = Number(usageAny.promptTokens || usageAny.inputTokens || 0)
      const completionTokens = Number(usageAny.completionTokens || usageAny.outputTokens || 0)
      const totalTokens = Number(usageAny.totalTokens || (promptTokens + completionTokens))

      logger.info('AI execution completed', {
        modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        finishReason,
        textLength: text.length,
      })

      // Invoke caller's onFinish callback (e.g., route handler writes to DB)
      if (onFinish) {
        try {
          await onFinish({
            text,
            usage: { promptTokens, completionTokens, totalTokens },
            finishReason
          })
        } catch (error) {
          logger.error('Error in onFinish callback', {
            modelId,
            error: error instanceof Error ? error.message : String(error),
          })
          // Don't throw - the stream has already completed successfully
        }
      }
    },
    onError({ error }) {
      logger.error('AI stream error', {
        modelId,
        error: error instanceof Error ? error.message : String(error),
      })
    },
  })

  return result
}

/**
 * Estimate cost in USD for a given model and token usage
 *
 * @param modelId - Full model ID like 'openai/gpt-4o-mini'
 * @param usage - Token usage (promptTokens, completionTokens)
 * @returns Estimated cost in USD (0 if model not found in pricing table)
 *
 * @example
 * ```typescript
 * const cost = estimateCost('openai/gpt-4o-mini', {
 *   promptTokens: 1000,
 *   completionTokens: 500
 * })
 * // Returns: 0.00045 (USD)
 * ```
 */
export function estimateCost(
  modelId: string,
  usage: { promptTokens: number; completionTokens: number }
): number {
  const pricing = PRICING[modelId]

  if (!pricing) {
    logger.warn('No pricing data for model', { modelId })
    return 0
  }

  const inputCost = (usage.promptTokens * pricing.input) / 1_000_000
  const outputCost = (usage.completionTokens * pricing.output) / 1_000_000

  return inputCost + outputCost
}
