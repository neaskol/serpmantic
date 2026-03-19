import type { SemanticTerm, SerpAnalysis } from '@/types/database'

/**
 * Context for enriching AI prompts with SERP data and user settings
 */
export interface PromptContext {
  keyword: string
  language: string
  semanticTerms: { term: string; minOccurrences: number; maxOccurrences: number; importance?: number }[]
  termsToAvoid: string[]
  structuralBenchmarks: Record<string, { min: number; max: number }>
  currentContent?: string
  selectedText?: string
  userContext?: {
    audience?: string
    tone?: string
    sector?: string
    brief?: string
  }
}

/**
 * Build prompt context from database types
 *
 * Transforms SERP analysis data and guide settings into a format
 * suitable for prompt enrichment.
 *
 * @param serpAnalysis - SERP analysis data (can be null for new guides)
 * @param semanticTerms - Semantic terms extracted from SERP
 * @param guide - Guide metadata (keyword, language)
 * @param options - Optional content and user context
 * @returns Enriched prompt context
 */
export function buildPromptContext(
  serpAnalysis: SerpAnalysis | null,
  semanticTerms: SemanticTerm[],
  guide: { keyword: string; language: string },
  options?: {
    selectedText?: string
    currentContent?: string
    userContext?: PromptContext['userContext']
  }
): PromptContext {
  // Extract terms to avoid (terms that don't correlate with ranking)
  const termsToAvoid = semanticTerms
    .filter((t) => t.is_to_avoid)
    .map((t) => t.display_term)

  // Map semantic terms (only non-avoided terms)
  const contextTerms = semanticTerms
    .filter((t) => !t.is_to_avoid)
    .map((t) => ({
      term: t.display_term,
      minOccurrences: t.min_occurrences,
      maxOccurrences: t.max_occurrences,
      importance: t.importance,
    }))

  // Use structural benchmarks from SERP analysis or empty object
  const structuralBenchmarks = serpAnalysis?.structural_benchmarks ?? {}

  return {
    keyword: guide.keyword,
    language: guide.language,
    semanticTerms: contextTerms,
    termsToAvoid,
    structuralBenchmarks,
    currentContent: options?.currentContent,
    selectedText: options?.selectedText,
    userContext: options?.userContext,
  }
}

/**
 * Replace template variables in prompt template
 *
 * Supported variables:
 * - {keyword} - Target keyword
 * - {language} - Content language
 * - {semantic_terms} - Top semantic terms (JSON)
 * - {terms_to_avoid} - Comma-separated list
 * - {structural_benchmarks} - Structural metrics (JSON)
 * - {content} - Current content
 * - {selected_text} - Selected text
 * - {audience} - Target audience
 * - {tone} - Writing tone
 * - {sector} - Industry sector
 * - {brief} - Content brief
 *
 * @param template - Template string with {variable} placeholders
 * @param context - Prompt context with values
 * @returns Template with variables replaced
 */
export function buildPrompt(template: string, context: PromptContext): string {
  // Prepare top 20 semantic terms sorted by importance
  const topTerms = [...context.semanticTerms]
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 20)
    .map((t) => `${t.term} (${t.minOccurrences}-${t.maxOccurrences} occurrences)`)

  // Build replacements map
  const replacements: Record<string, string> = {
    keyword: context.keyword,
    language: context.language,
    semantic_terms: JSON.stringify(topTerms, null, 2),
    terms_to_avoid: context.termsToAvoid.join(', '),
    structural_benchmarks: JSON.stringify(context.structuralBenchmarks, null, 2),
    content: context.currentContent ?? '',
    selected_text: context.selectedText ?? '',
    audience: context.userContext?.audience ?? '',
    tone: context.userContext?.tone ?? '',
    sector: context.userContext?.sector ?? '',
    brief: context.userContext?.brief ?? '',
  }

  // Replace all {variable} patterns
  return template.replace(/\{(\w+)\}/g, (_, key) => replacements[key] ?? '')
}

/**
 * Build system message with SERP-aware instructions
 *
 * Produces a system prompt in RCCF format (Role-Context-Constraint-Format)
 * that includes SERP semantic data and user context.
 *
 * @param taskType - Type of task being performed
 * @param context - Prompt context with SERP and user data
 * @returns System message string
 */
export function buildSystemMessage(taskType: string, context: PromptContext): string {
  // Prepare top 10 terms for system message
  const topTerms = [...context.semanticTerms]
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 10)
    .map((t) => t.term)

  const sections: string[] = []

  // Role (based on task type)
  sections.push(`You are an expert SEO content ${taskType.replace(/_/g, ' ')} assistant.`)

  // Context - SERP data
  sections.push(`\nTarget keyword: ${context.keyword}`)
  sections.push(`Language: ${context.language}`)

  if (topTerms.length > 0) {
    sections.push(
      `\nImportant semantic terms to incorporate:\n${topTerms.map((t) => `- ${t}`).join('\n')}`
    )
  }

  if (context.termsToAvoid.length > 0) {
    sections.push(
      `\nTerms to AVOID (not correlated with ranking):\n${context.termsToAvoid.map((t) => `- ${t}`).join('\n')}`
    )
  }

  // Context - user preferences
  if (context.userContext?.audience) {
    sections.push(`\nTarget audience: ${context.userContext.audience}`)
  }

  // Constraints
  if (context.userContext?.tone) {
    sections.push(`\nWrite in a ${context.userContext.tone} tone.`)
  }

  sections.push(
    '\nDo not exceed the semantic benchmarks. Over-optimization (score > 100) should be avoided.'
  )

  sections.push('\nFocus on natural, high-quality content that serves the user intent.')

  return sections.join('')
}
