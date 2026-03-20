import { describe, it, expect } from 'vitest'
import { estimateCost } from '../executor'

describe('AI Executor', () => {
  describe('estimateCost', () => {
    it('calculates cost for gpt-4o-mini correctly', () => {
      const cost = estimateCost('openai/gpt-4o-mini', {
        promptTokens: 1000,
        completionTokens: 500,
      })

      // (1000 * 0.15 / 1M) + (500 * 0.6 / 1M) = 0.00015 + 0.0003 = 0.00045
      expect(cost).toBeCloseTo(0.00045, 5)
    })

    it('calculates cost for gpt-4o correctly', () => {
      const cost = estimateCost('openai/gpt-4o', {
        promptTokens: 1000,
        completionTokens: 500,
      })

      // (1000 * 2.5 / 1M) + (500 * 10.0 / 1M) = 0.0025 + 0.005 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 5)
    })

    it('calculates cost for claude-sonnet-4-5 correctly', () => {
      const cost = estimateCost('anthropic/claude-sonnet-4-5-20250929', {
        promptTokens: 1000,
        completionTokens: 500,
      })

      // (1000 * 3.0 / 1M) + (500 * 15.0 / 1M) = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 5)
    })

    it('calculates cost for claude-sonnet-4 correctly', () => {
      const cost = estimateCost('anthropic/claude-sonnet-4-20250514', {
        promptTokens: 1000,
        completionTokens: 500,
      })

      // (1000 * 3.0 / 1M) + (500 * 15.0 / 1M) = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 5)
    })

    it('returns 0 for unknown model', () => {
      const cost = estimateCost('unknown/model', {
        promptTokens: 1000,
        completionTokens: 500,
      })

      expect(cost).toBe(0)
    })

    it('returns 0 for zero tokens', () => {
      const cost = estimateCost('openai/gpt-4o-mini', {
        promptTokens: 0,
        completionTokens: 0,
      })

      expect(cost).toBe(0)
    })

    it('handles only prompt tokens', () => {
      const cost = estimateCost('openai/gpt-4o-mini', {
        promptTokens: 1000,
        completionTokens: 0,
      })

      // (1000 * 0.15 / 1M) = 0.00015
      expect(cost).toBeCloseTo(0.00015, 5)
    })

    it('handles only completion tokens', () => {
      const cost = estimateCost('openai/gpt-4o-mini', {
        promptTokens: 0,
        completionTokens: 500,
      })

      // (500 * 0.6 / 1M) = 0.0003
      expect(cost).toBeCloseTo(0.0003, 5)
    })

    it('handles large token counts', () => {
      const cost = estimateCost('openai/gpt-4o', {
        promptTokens: 100000,
        completionTokens: 50000,
      })

      // (100000 * 2.5 / 1M) + (50000 * 10.0 / 1M) = 0.25 + 0.5 = 0.75
      expect(cost).toBeCloseTo(0.75, 5)
    })

    it('returns fractional costs for small requests', () => {
      const cost = estimateCost('openai/gpt-4o-mini', {
        promptTokens: 10,
        completionTokens: 5,
      })

      // (10 * 0.15 / 1M) + (5 * 0.6 / 1M) = 0.0000015 + 0.000003 = 0.0000045
      expect(cost).toBeCloseTo(0.0000045, 10)
    })
  })
})
