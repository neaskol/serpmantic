/**
 * LLM Router: Maps task types to optimal language models
 *
 * Design decisions:
 * - Claude Sonnet 4.5: Best for structured outline generation (plan_generation)
 * - Claude Sonnet 4: Best for narrative coherence (introduction, intent_analysis)
 * - GPT-4o: Best for rule-based tasks and multimodal reasoning (grammar_check, media_suggestions)
 * - GPT-4o Mini: Best for cost-sensitive tasks (content_editing, semantic_optimization, meta_generation)
 *
 * Model IDs can be overridden in the database prompts table without code changes.
 */

export type TaskType =
  | 'plan_generation'
  | 'introduction'
  | 'intent_analysis'
  | 'content_editing'
  | 'grammar_check'
  | 'semantic_optimization'
  | 'meta_generation'
  | 'media_suggestions'

/**
 * Central mapping of task types to model IDs
 *
 * Format: 'provider/model-name'
 * - Anthropic: claude-sonnet-4-5-20250929, claude-sonnet-4-20250514
 * - OpenAI: gpt-4o, gpt-4o-mini
 *
 * Note: Starting with gpt-4o/gpt-4o-mini (well-tested).
 * Can be updated to GPT-5 later via database model_id overrides.
 */
export const MODEL_MAP: Record<TaskType, string> = {
  plan_generation: 'anthropic/claude-sonnet-4-5-20250929',
  introduction: 'anthropic/claude-sonnet-4-20250514',
  intent_analysis: 'anthropic/claude-sonnet-4-20250514',
  content_editing: 'openai/gpt-4o-mini',
  grammar_check: 'openai/gpt-4o',
  semantic_optimization: 'openai/gpt-4o-mini',
  meta_generation: 'openai/gpt-4o-mini',
  media_suggestions: 'openai/gpt-4o',
}

/**
 * Default model used as fallback
 */
export const DEFAULT_MODEL = 'openai/gpt-4o-mini'

/**
 * Get the model ID for a given task type
 *
 * @param taskType - The type of task to perform
 * @returns Model ID in format 'provider/model-name'
 */
export function getModelForTask(taskType: TaskType): string {
  return MODEL_MAP[taskType]
}

/**
 * Extract provider name from model ID
 *
 * @param taskType - The type of task to perform
 * @returns Provider name ('anthropic' or 'openai')
 */
export function getProviderForTask(taskType: TaskType): 'anthropic' | 'openai' {
  const modelId = MODEL_MAP[taskType]
  const provider = modelId.split('/')[0] as 'anthropic' | 'openai'
  return provider
}
