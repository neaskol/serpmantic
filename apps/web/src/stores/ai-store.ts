import { create } from 'zustand'
import type { AiStatus } from '@/types/database'

interface AiState {
  // State
  status: AiStatus
  streamedText: string
  error: string | null
  lastPromptId: string | null
  lastResult: string | null

  // Actions
  executePrompt: (promptId: string, guideId: string, options?: {
    selectedText?: string
    scope?: 'selection' | 'document'
  }) => Promise<void>
  appendStreamedText: (chunk: string) => void
  acceptResult: () => string | null
  rejectResult: () => void
  reset: () => void
}

export const useAiStore = create<AiState>()((set, get) => ({
  status: 'idle',
  streamedText: '',
  error: null,
  lastPromptId: null,
  lastResult: null,

  executePrompt: async (promptId, guideId, options) => {
    // Reset state before starting
    set({ status: 'loading', error: null, streamedText: '', lastResult: null })

    try {
      const response = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId,
          guideId,
          selectedText: options?.selectedText,
          scope: options?.scope || 'document',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'AI execution failed' }))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body — streaming not supported')
      }

      set({ status: 'streaming', lastPromptId: promptId })

      // Read the stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        set((state) => ({ streamedText: state.streamedText + chunk }))
      }

      // Stream complete
      set((state) => ({
        status: 'success',
        lastResult: state.streamedText,
      }))
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  appendStreamedText: (chunk) =>
    set((state) => ({ streamedText: state.streamedText + chunk })),

  acceptResult: () => {
    const result = get().lastResult
    set({ status: 'idle', streamedText: '', lastResult: null, lastPromptId: null })
    return result  // Caller (Phase 2 UI component) uses this return value
  },

  rejectResult: () => {
    set({ status: 'idle', streamedText: '', lastResult: null, lastPromptId: null })
  },

  reset: () => set({
    status: 'idle',
    streamedText: '',
    error: null,
    lastPromptId: null,
    lastResult: null,
  }),
}))
