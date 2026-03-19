import { z } from 'zod'

// SERP Analysis Request
export const AnalyzeRequestSchema = z.object({
  keyword: z.string().min(1, "Keyword required").max(200, "Keyword too long"),
  language: z.enum(['fr', 'en', 'it', 'de', 'es'], {
    message: "Invalid language"
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
  content: z.any(), // TipTap JSON schema
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(158).optional(),
})

export type UpdateGuideRequest = z.infer<typeof UpdateGuideSchema>
