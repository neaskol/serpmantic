import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executePrompt, estimateCost } from '../executor'
import { mockAiResponse } from '@/test/mocks'

// Mock ai SDK
vi.mock('ai', () => ({
  streamText: vi.fn(),
}))

// Mock registry
vi.mock('../registry', () => ({
  getModel: vi.fn((modelId) => ({
    id: modelId,
    provider: modelId.split('/')[0],
  })),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import after mocks
import { streamText } from 'ai'

describe('executePrompt integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute prompt with streaming and call onFinish callback', async () => {
    const mockText = 'AI generated response text'
    const mockUsage = {
      promptTokens: 150,
      completionTokens: 75,
      totalTokens: 225,
    }

    const onFinishSpy = vi.fn()

    // Mock streamText to return our mock response and trigger onFinish
    vi.mocked(streamText).mockImplementation(async (options) => {
      // Simulate calling onFinish after stream completes
      if (options.onFinish) {
        await options.onFinish({
          text: mockText,
          usage: mockUsage,
          finishReason: 'stop',
        })
      }
      return mockAiResponse(mockText, mockUsage) as never
    })

    const result = await executePrompt({
      modelId: 'openai/gpt-4o-mini',
      prompt: 'Test prompt',
      systemPrompt: 'You are a test assistant',
      onFinish: onFinishSpy,
    })

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        system: 'You are a test assistant',
      })
    )

    expect(onFinishSpy).toHaveBeenCalledWith({
      text: mockText,
      usage: mockUsage,
      finishReason: 'stop',
    })

    const textResponse = await result.text
    expect(textResponse).toBe(mockText)
  })

  it('should handle AI SDK v5 usage property name fallback (inputTokens/outputTokens)', async () => {
    const mockText = 'Response'
    // AI SDK v5 uses inputTokens/outputTokens
    const mockUsage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    }

    const onFinishSpy = vi.fn()

    vi.mocked(streamText).mockImplementation(async (options) => {
      if (options.onFinish) {
        await options.onFinish({
          text: mockText,
          usage: mockUsage as never,
          finishReason: 'stop',
        })
      }
      return mockAiResponse(mockText, mockUsage) as never
    })

    await executePrompt({
      modelId: 'anthropic/claude-sonnet-4-20250514',
      prompt: 'Test',
      onFinish: onFinishSpy,
    })

    // onFinish should receive normalized property names
    expect(onFinishSpy).toHaveBeenCalledWith({
      text: mockText,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
    })
  })

  it('should not throw if onFinish callback fails', async () => {
    const onFinishError = new Error('DB write failed')
    const onFinishSpy = vi.fn().mockRejectedValue(onFinishError)

    vi.mocked(streamText).mockImplementation(async (options) => {
      if (options.onFinish) {
        await options.onFinish({
          text: 'Test',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
        })
      }
      return mockAiResponse('Test') as never
    })

    // Should not throw even if onFinish fails (stream completed successfully)
    await expect(
      executePrompt({
        modelId: 'openai/gpt-4o-mini',
        prompt: 'Test',
        onFinish: onFinishSpy,
      })
    ).resolves.toBeDefined()

    expect(onFinishSpy).toHaveBeenCalled()
  })

  it('should call onError callback when stream fails', async () => {
    const streamError = new Error('AI provider timeout')

    vi.mocked(streamText).mockImplementation(async (options) => {
      if (options.onError) {
        options.onError({ error: streamError })
      }
      throw streamError
    })

    await expect(
      executePrompt({
        modelId: 'openai/gpt-4o-mini',
        prompt: 'Test',
      })
    ).rejects.toThrow('AI provider timeout')
  })
})

describe('estimateCost', () => {
  it('should calculate cost correctly for GPT-4o Mini', () => {
    const cost = estimateCost('openai/gpt-4o-mini', {
      promptTokens: 1000,
      completionTokens: 500,
    })

    // GPT-4o Mini: $0.15/M input, $0.60/M output
    // (1000 * 0.15 / 1M) + (500 * 0.60 / 1M) = 0.00015 + 0.0003 = 0.00045
    expect(cost).toBeCloseTo(0.00045)
  })

  it('should calculate cost correctly for Claude Sonnet 4.5', () => {
    const cost = estimateCost('anthropic/claude-sonnet-4-5-20250929', {
      promptTokens: 2000,
      completionTokens: 1000,
    })

    // Claude Sonnet 4.5: $3/M input, $15/M output
    // (2000 * 3 / 1M) + (1000 * 15 / 1M) = 0.006 + 0.015 = 0.021
    expect(cost).toBeCloseTo(0.021)
  })

  it('should return 0 for unknown model', () => {
    const cost = estimateCost('unknown/model', {
      promptTokens: 1000,
      completionTokens: 500,
    })

    expect(cost).toBe(0)
  })

  it('should handle zero tokens', () => {
    const cost = estimateCost('openai/gpt-4o-mini', {
      promptTokens: 0,
      completionTokens: 0,
    })

    expect(cost).toBe(0)
  })
})
