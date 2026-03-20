import { describe, it, expect } from 'vitest'
import { getModelForTask, getProviderForTask, MODEL_MAP, type TaskType } from '../router'

describe('AI Router', () => {
  describe('getModelForTask', () => {
    it('returns Claude Sonnet 4.5 for plan_generation', () => {
      expect(getModelForTask('plan_generation')).toBe('anthropic/claude-sonnet-4-5-20250929')
    })

    it('returns Claude Sonnet 4 for introduction', () => {
      expect(getModelForTask('introduction')).toBe('anthropic/claude-sonnet-4-20250514')
    })

    it('returns Claude Sonnet 4 for intent_analysis', () => {
      expect(getModelForTask('intent_analysis')).toBe('anthropic/claude-sonnet-4-20250514')
    })

    it('returns GPT-4o Mini for content_editing', () => {
      expect(getModelForTask('content_editing')).toBe('openai/gpt-4o-mini')
    })

    it('returns GPT-4o for grammar_check', () => {
      expect(getModelForTask('grammar_check')).toBe('openai/gpt-4o')
    })

    it('returns GPT-4o Mini for semantic_optimization', () => {
      expect(getModelForTask('semantic_optimization')).toBe('openai/gpt-4o-mini')
    })

    it('returns GPT-4o Mini for meta_generation', () => {
      expect(getModelForTask('meta_generation')).toBe('openai/gpt-4o-mini')
    })

    it('returns GPT-4o for media_suggestions', () => {
      expect(getModelForTask('media_suggestions')).toBe('openai/gpt-4o')
    })

    it('covers all 8 TaskType values', () => {
      const taskTypes: TaskType[] = [
        'plan_generation',
        'introduction',
        'intent_analysis',
        'content_editing',
        'grammar_check',
        'semantic_optimization',
        'meta_generation',
        'media_suggestions',
      ]

      expect(Object.keys(MODEL_MAP).length).toBe(8)
      taskTypes.forEach(taskType => {
        expect(MODEL_MAP[taskType]).toBeDefined()
      })
    })
  })

  describe('getProviderForTask', () => {
    it('returns "anthropic" for plan_generation', () => {
      expect(getProviderForTask('plan_generation')).toBe('anthropic')
    })

    it('returns "anthropic" for introduction', () => {
      expect(getProviderForTask('introduction')).toBe('anthropic')
    })

    it('returns "anthropic" for intent_analysis', () => {
      expect(getProviderForTask('intent_analysis')).toBe('anthropic')
    })

    it('returns "openai" for content_editing', () => {
      expect(getProviderForTask('content_editing')).toBe('openai')
    })

    it('returns "openai" for grammar_check', () => {
      expect(getProviderForTask('grammar_check')).toBe('openai')
    })

    it('returns "openai" for semantic_optimization', () => {
      expect(getProviderForTask('semantic_optimization')).toBe('openai')
    })

    it('returns "openai" for meta_generation', () => {
      expect(getProviderForTask('meta_generation')).toBe('openai')
    })

    it('returns "openai" for media_suggestions', () => {
      expect(getProviderForTask('media_suggestions')).toBe('openai')
    })
  })
})
