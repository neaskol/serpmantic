import { create } from 'zustand'
import type { Guide, SerpAnalysis, SerpPage, SemanticTerm, TermStatus, ScoreLabel, StructuralMetrics } from '@/types/database'
import { calculateScore, calculateStructuralMetrics } from '@/lib/scoring'

type TermFilter = 'all' | 'missing' | 'excess'

interface GuideState {
  // Data
  guide: Guide | null
  serpAnalysis: SerpAnalysis | null
  serpPages: SerpPage[]
  semanticTerms: SemanticTerm[]

  // Computed (from scoring)
  score: number
  scoreLabel: ScoreLabel
  scoreColor: string
  termStatuses: TermStatus[]
  structuralMetrics: StructuralMetrics

  // UI state
  activeTab: string
  termFilter: TermFilter

  // Actions
  setGuide: (guide: Guide) => void
  setSerpData: (analysis: SerpAnalysis, pages: SerpPage[], terms: SemanticTerm[]) => void
  recalculateScore: (plainText: string, content: Record<string, unknown>) => void
  setActiveTab: (tab: string) => void
  setTermFilter: (filter: TermFilter) => void
}

export const useGuideStore = create<GuideState>()((set, get) => ({
  guide: null,
  serpAnalysis: null,
  serpPages: [],
  semanticTerms: [],

  score: 0,
  scoreLabel: 'Mauvais',
  scoreColor: '#ef4444',
  termStatuses: [],
  structuralMetrics: { words: 0, headings: 0, paragraphs: 0, links: 0, images: 0, videos: 0, tables: 0, lists: 0 },

  activeTab: 'optimization',
  termFilter: 'all',

  setGuide: (guide) => set({ guide }),

  setSerpData: (analysis, pages, terms) => set({
    serpAnalysis: analysis,
    serpPages: pages,
    semanticTerms: terms,
  }),

  recalculateScore: (plainText, content) => {
    const { semanticTerms } = get()
    if (semanticTerms.length === 0) return

    const result = calculateScore(plainText, semanticTerms)
    const structuralMetrics = calculateStructuralMetrics(content)

    set({
      score: result.score,
      scoreLabel: result.label,
      scoreColor: result.color,
      termStatuses: result.termStatuses,
      structuralMetrics,
    })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setTermFilter: (filter) => set({ termFilter: filter }),
}))
