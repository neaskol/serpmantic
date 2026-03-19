import { create } from 'zustand'
import type { PromptContextRecord } from '@/types/database'

interface ContextState {
  // State
  contexts: PromptContextRecord[]
  activeContextId: string | null
  loading: boolean
  error: string | null

  // Actions
  fetchContexts: () => Promise<void>
  createContext: (data: { name: string; audience?: string; tone?: string; sector?: string; brief?: string }) => Promise<PromptContextRecord | null>
  updateContext: (id: string, data: Partial<{ name: string; audience: string; tone: string; sector: string; brief: string }>) => Promise<void>
  deleteContext: (id: string) => Promise<void>
  setActiveContext: (id: string | null, guideId: string) => Promise<void>
  initActiveContext: (contextId: string | null) => void
}

export const useContextStore = create<ContextState>()((set) => ({
  contexts: [],
  activeContextId: null,
  loading: false,
  error: null,

  fetchContexts: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/contexts')
      if (!res.ok) throw new Error('Failed to fetch contexts')
      const data = await res.json()
      set({ contexts: data.contexts || [], loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  },

  createContext: async (data) => {
    try {
      const res = await fetch('/api/contexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create context')
      const result = await res.json()
      const newContext = result.context as PromptContextRecord
      set((state) => ({ contexts: [newContext, ...state.contexts] }))
      return newContext
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
      return null
    }
  },

  updateContext: async (id, data) => {
    try {
      const res = await fetch(`/api/contexts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update context')
      const result = await res.json()
      set((state) => ({
        contexts: state.contexts.map((c) => c.id === id ? result.context : c),
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  },

  deleteContext: async (id) => {
    try {
      const res = await fetch(`/api/contexts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete context')
      set((state) => ({
        contexts: state.contexts.filter((c) => c.id !== id),
        // Clear active context if deleted
        activeContextId: state.activeContextId === id ? null : state.activeContextId,
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  },

  // Persist active context selection to guide via PATCH /api/guides/[id]
  setActiveContext: async (id, guideId) => {
    try {
      const res = await fetch(`/api/guides/${guideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_context_id: id }),
      })
      if (!res.ok) throw new Error('Failed to set active context')
      set({ activeContextId: id })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  },

  // Initialize active context from guide data (no API call)
  initActiveContext: (contextId) => {
    set({ activeContextId: contextId })
  },
}))
