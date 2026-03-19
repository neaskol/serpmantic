import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

/**
 * Centralized provider registry for multi-LLM support
 * Supports both Anthropic (Claude) and OpenAI (GPT) providers
 *
 * Environment variables required:
 * - ANTHROPIC_API_KEY
 * - OPENAI_API_KEY
 */

/**
 * Provider registry maps provider prefixes to their SDK instances
 */
export const registry = {
  anthropic,
  openai,
} as const

/**
 * Get a language model by ID
 *
 * In AI SDK v5+, model IDs use format 'provider/model-name'
 * Example: 'anthropic/claude-sonnet-4-5-20250929' or 'openai/gpt-4o'
 *
 * @param modelId - Model identifier in format 'provider/model-name'
 * @returns Language model instance
 *
 * @throws Error if model ID is invalid or provider is not configured
 */
export function getModel(modelId: string) {
  const [providerName, modelName] = modelId.split('/')

  if (!providerName || !modelName) {
    throw new Error(`Invalid model ID format: ${modelId}. Expected 'provider/model-name'`)
  }

  const provider = registry[providerName as keyof typeof registry]

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(registry).join(', ')}`)
  }

  return provider(modelName)
}
