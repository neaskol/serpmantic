export type Guide = {
  id: string
  user_id: string
  keyword: string
  language: 'fr' | 'en' | 'it' | 'de' | 'es'
  search_engine: string
  content: Record<string, unknown>
  meta_title: string
  meta_description: string
  linked_url: string | null
  group_id: string | null
  visibility: 'private' | 'read' | 'edit'
  share_token: string | null
  score: number
  prompt_context: PromptContext | null
  active_context_id: string | null
  created_at: string
  updated_at: string
}

export type SerpAnalysis = {
  id: string
  guide_id: string
  keyword: string
  language: string
  analyzed_at: string
  structural_benchmarks: StructuralBenchmarks
  refresh_interval_months: number
  refresh_recommended_at: string | null
  created_at: string
}

export type StructuralBenchmarks = {
  words: { min: number; max: number }
  headings: { min: number; max: number }
  paragraphs: { min: number; max: number }
  links: { min: number; max: number }
  images: { min: number; max: number }
  videos: { min: number; max: number }
  tables: { min: number; max: number }
  lists: { min: number; max: number }
}

export type SerpPage = {
  id: string
  serp_analysis_id: string
  url: string
  title: string
  score: number
  is_excluded: boolean
  metrics: StructuralMetrics
  term_occurrences: Record<string, number>
  position: number
}

export type StructuralMetrics = {
  words: number
  headings: number
  paragraphs: number
  links: number
  images: number
  videos: number
  tables: number
  lists: number
}

export type SemanticTerm = {
  id: string
  serp_analysis_id: string
  term: string
  display_term: string
  is_main_keyword: boolean
  min_occurrences: number
  max_occurrences: number
  importance: number
  term_type: 'unigram' | 'bigram' | 'trigram' | 'phrase'
  is_to_avoid: boolean
}

export type TermStatus = {
  term: SemanticTerm
  count: number
  status: 'ok' | 'missing' | 'excess'
  delta: number
}

export type ScoreLabel = 'Mauvais' | 'Moyen' | 'Bon' | 'Excellent' | 'Sur-optimise'

export type ScoreResult = {
  score: number
  label: ScoreLabel
  color: string
  termStatuses: TermStatus[]
  structuralMetrics: StructuralMetrics
}

// === AI Module Types (Sprint 3) ===

export type Prompt = {
  id: string
  title: string
  description: string | null
  llm_provider: 'anthropic' | 'openai'
  model_id: string
  task_type: string
  prompt_template: string
  system_prompt: string | null
  scope: 'selection' | 'document' | 'full'
  is_public: boolean
  owner_id: string | null
  category: string | null
  created_at: string
  updated_at: string
}

export type AiRequest = {
  id: string
  user_id: string
  guide_id: string
  prompt_id: string | null
  model_id: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: number
  finish_reason: string | null
  error_message: string | null
  created_at: string
}

export type AiStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

export type PromptContext = {
  audience?: string
  tone?: string
  sector?: string
  brief?: string
}

export type PromptContextRecord = {
  id: string
  user_id: string
  name: string
  audience: string
  tone: string
  sector: string
  brief: string
  created_at: string
  updated_at: string
}
