import { z } from 'zod'

// SERP Analysis Request
export const AnalyzeRequestSchema = z.object({
  keyword: z.string().min(1, "Keyword required").max(200, "Keyword too long"),
  language: z.enum(['fr', 'en', 'it', 'de', 'es'], {
    message: "Invalid language - must be one of: fr, en, it, de, es"
  }),
  searchEngine: z.string().url("Invalid search engine URL"),
  guideId: z.string().uuid("Invalid guide ID"),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

// Create Guide Request
export const CreateGuideSchema = z.object({
  keyword: z.string().min(1).max(200),
  language: z.enum(['fr', 'en', 'it', 'de', 'es']).default('fr'),
  searchEngine: z.string().url().default('https://google.fr'),
})

export type CreateGuideRequest = z.infer<typeof CreateGuideSchema>

// Update Guide Request
export const UpdateGuideSchema = z.object({
  content: z.any(), // TipTap JSON schema - validated by TipTap itself
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(158).optional(),
  linkedUrl: z.string().url().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  active_context_id: z.string().uuid().optional().nullable(),
})

export type UpdateGuideRequest = z.infer<typeof UpdateGuideSchema>

// NLP Analysis Response (for type safety)
export const SemanticTermSchema = z.object({
  term: z.string(),
  displayTerm: z.string(),
  isMainKeyword: z.boolean().optional().default(false),
  minOccurrences: z.number().int().min(0),
  maxOccurrences: z.number().int().min(0),
  importance: z.number().min(0).max(1),
  termType: z.enum(['unigram', 'bigram', 'trigram', 'phrase']),
})

export type SemanticTerm = z.infer<typeof SemanticTermSchema>

export const NLPAnalysisResponseSchema = z.object({
  terms: z.array(SemanticTermSchema),
  termsToAvoid: z.array(z.string()),
})

export type NLPAnalysisResponse = z.infer<typeof NLPAnalysisResponseSchema>

// SERP Page Metrics
export const PageMetricsSchema = z.object({
  words: z.number().int().min(0),
  headings: z.number().int().min(0),
  paragraphs: z.number().int().min(0),
  links: z.number().int().min(0),
  images: z.number().int().min(0),
  videos: z.number().int().min(0),
  tables: z.number().int().min(0),
  lists: z.number().int().min(0),
})

export type PageMetrics = z.infer<typeof PageMetricsSchema>

// Structural Benchmarks
export const StructuralBenchmarksSchema = z.object({
  words: z.object({ min: z.number(), max: z.number() }),
  headings: z.object({ min: z.number(), max: z.number() }),
  paragraphs: z.object({ min: z.number(), max: z.number() }),
  links: z.object({ min: z.number(), max: z.number() }),
  images: z.object({ min: z.number(), max: z.number() }),
  videos: z.object({ min: z.number(), max: z.number() }),
  tables: z.object({ min: z.number(), max: z.number() }),
  lists: z.object({ min: z.number(), max: z.number() }),
})

export type StructuralBenchmarks = z.infer<typeof StructuralBenchmarksSchema>

// Helper function to handle Zod validation errors
export function formatZodError(error: z.ZodError): string {
  return error.message
}

// === AI Module Schemas (Sprint 3) ===

export const ExecuteRequestSchema = z.object({
  promptId: z.string().uuid(),
  guideId: z.string().uuid(),
  selectedText: z.string().optional(),
  scope: z.enum(['selection', 'document']).default('document'),
})

export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>

export const PromptContextSchema = z.object({
  audience: z.string().max(200).optional(),
  tone: z.string().max(100).optional(),
  sector: z.string().max(200).optional(),
  brief: z.string().max(2000).optional(),
})

export type PromptContextInput = z.infer<typeof PromptContextSchema>

// === Context System Schemas (Phase 5) ===

export const CreateContextSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  audience: z.string().max(200).optional().default(''),
  tone: z.string().max(100).optional().default(''),
  sector: z.string().max(200).optional().default(''),
  brief: z.string().max(2000).optional().default(''),
})

export type CreateContextInput = z.infer<typeof CreateContextSchema>

export const UpdateContextSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  audience: z.string().max(200).optional(),
  tone: z.string().max(100).optional(),
  sector: z.string().max(200).optional(),
  brief: z.string().max(2000).optional(),
})

export type UpdateContextInput = z.infer<typeof UpdateContextSchema>
