import { describe, it, expect } from 'vitest'
import { buildPromptContext, buildPrompt, buildSystemMessage } from '../context-builder'
import type { SemanticTerm, SerpAnalysis } from '@/types/database'

// Helper to create mock semantic terms
const mockTerm = (overrides: Partial<SemanticTerm> = {}): SemanticTerm => ({
  id: 'term-1',
  serp_analysis_id: 'serp-1',
  term: 'energie',
  display_term: 'énergie',
  is_main_keyword: false,
  min_occurrences: 3,
  max_occurrences: 8,
  importance: 1.0,
  term_type: 'unigram',
  is_to_avoid: false,
  ...overrides,
})

const mockSerpAnalysis = (overrides: Partial<SerpAnalysis> = {}): SerpAnalysis => ({
  id: 'serp-1',
  guide_id: 'guide-1',
  keyword: 'delegation',
  language: 'fr',
  analyzed_at: new Date().toISOString(),
  structural_benchmarks: {
    words: { min: 1000, max: 2000 },
    headings: { min: 10, max: 20 },
  },
  refresh_interval_months: 6,
  ...overrides,
})

describe('Context Builder', () => {
  describe('buildPromptContext', () => {
    it('filters is_to_avoid terms into termsToAvoid array', () => {
      const terms = [
        mockTerm({ term: 'good', display_term: 'good', is_to_avoid: false }),
        mockTerm({ term: 'bad', display_term: 'bad', is_to_avoid: true }),
        mockTerm({ term: 'ugly', display_term: 'ugly', is_to_avoid: true }),
      ]

      const context = buildPromptContext(
        mockSerpAnalysis(),
        terms,
        { keyword: 'test', language: 'fr' }
      )

      expect(context.termsToAvoid).toEqual(['bad', 'ugly'])
      expect(context.semanticTerms.length).toBe(1)
      expect(context.semanticTerms[0].term).toBe('good')
    })

    it('maps non-avoided terms with display_term, min, max, importance', () => {
      const terms = [
        mockTerm({
          term: 'energie',
          display_term: 'énergie',
          min_occurrences: 5,
          max_occurrences: 10,
          importance: 2.5,
          is_to_avoid: false,
        }),
      ]

      const context = buildPromptContext(
        mockSerpAnalysis(),
        terms,
        { keyword: 'test', language: 'fr' }
      )

      expect(context.semanticTerms[0]).toEqual({
        term: 'énergie',
        minOccurrences: 5,
        maxOccurrences: 10,
        importance: 2.5,
      })
    })

    it('uses structural_benchmarks from serpAnalysis when available', () => {
      const serpAnalysis = mockSerpAnalysis({
        structural_benchmarks: {
          words: { min: 1500, max: 2500 },
          headings: { min: 8, max: 15 },
        },
      })

      const context = buildPromptContext(
        serpAnalysis,
        [],
        { keyword: 'test', language: 'fr' }
      )

      expect(context.structuralBenchmarks).toEqual({
        words: { min: 1500, max: 2500 },
        headings: { min: 8, max: 15 },
      })
    })

    it('uses empty object when serpAnalysis is null', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' }
      )

      expect(context.structuralBenchmarks).toEqual({})
    })

    it('passes through keyword and language', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'delegataire cee', language: 'fr' }
      )

      expect(context.keyword).toBe('delegataire cee')
      expect(context.language).toBe('fr')
    })

    it('includes optional currentContent and selectedText', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        {
          currentContent: 'My content here',
          selectedText: 'selected',
        }
      )

      expect(context.currentContent).toBe('My content here')
      expect(context.selectedText).toBe('selected')
    })

    it('includes optional userContext', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        {
          userContext: {
            audience: 'developers',
            tone: 'professional',
            sector: 'tech',
            brief: 'Build fast',
          },
        }
      )

      expect(context.userContext).toEqual({
        audience: 'developers',
        tone: 'professional',
        sector: 'tech',
        brief: 'Build fast',
      })
    })

    it('handles empty semanticTerms array', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' }
      )

      expect(context.semanticTerms).toEqual([])
      expect(context.termsToAvoid).toEqual([])
    })
  })

  describe('buildPrompt', () => {
    it('replaces {keyword} with context.keyword', () => {
      const template = 'Write about {keyword} in detail'
      const context = buildPromptContext(null, [], { keyword: 'SEO', language: 'en' })
      const result = buildPrompt(template, context)

      expect(result).toContain('Write about SEO in detail')
    })

    it('replaces {language} with context.language', () => {
      const template = 'Write in {language} language'
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildPrompt(template, context)

      expect(result).toContain('Write in fr language')
    })

    it('replaces {semantic_terms} with JSON of top 20 terms sorted by importance', () => {
      const terms = [
        mockTerm({ term: 'low', display_term: 'low', importance: 0.5, min_occurrences: 1, max_occurrences: 3 }),
        mockTerm({ term: 'high', display_term: 'high', importance: 2.0, min_occurrences: 5, max_occurrences: 10 }),
      ]
      const template = 'Terms: {semantic_terms}'
      const context = buildPromptContext(null, terms, { keyword: 'test', language: 'fr' })
      const result = buildPrompt(template, context)

      expect(result).toContain('high (5-10 occurrences)')
      expect(result).toContain('low (1-3 occurrences)')
      // High importance should come first
      expect(result.indexOf('high')).toBeLessThan(result.indexOf('low'))
    })

    it('replaces {terms_to_avoid} with comma-separated list', () => {
      const terms = [
        mockTerm({ term: 'cookies', display_term: 'cookies', is_to_avoid: true }),
        mockTerm({ term: 'expert', display_term: 'expert', is_to_avoid: true }),
      ]
      const template = 'Avoid: {terms_to_avoid}'
      const context = buildPromptContext(null, terms, { keyword: 'test', language: 'fr' })
      const result = buildPrompt(template, context)

      expect(result).toBe('Avoid: cookies, expert')
    })

    it('replaces {content} with currentContent', () => {
      const template = 'Improve this: {content}'
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        { currentContent: 'Original text' }
      )
      const result = buildPrompt(template, context)

      expect(result).toBe('Improve this: Original text')
    })

    it('replaces {selected_text} with selectedText', () => {
      const template = 'Fix: {selected_text}'
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        { selectedText: 'This needs work' }
      )
      const result = buildPrompt(template, context)

      expect(result).toBe('Fix: This needs work')
    })

    it('replaces {audience}, {tone}, {sector}, {brief} with userContext values', () => {
      const template = 'Audience: {audience}, Tone: {tone}, Sector: {sector}, Brief: {brief}'
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        {
          userContext: {
            audience: 'CTOs',
            tone: 'technical',
            sector: 'SaaS',
            brief: 'Focus on security',
          },
        }
      )
      const result = buildPrompt(template, context)

      expect(result).toBe('Audience: CTOs, Tone: technical, Sector: SaaS, Brief: Focus on security')
    })

    it('replaces missing variables with empty string', () => {
      const template = 'Content: {content}, Selected: {selected_text}'
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildPrompt(template, context)

      expect(result).toBe('Content: , Selected: ')
    })

    it('handles unknown variables by replacing with empty string', () => {
      const template = 'Test {unknown_var} here'
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildPrompt(template, context)

      expect(result).toBe('Test  here')
    })
  })

  describe('buildSystemMessage', () => {
    it('includes taskType in role description', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('You are an expert SEO content plan generation assistant.')
    })

    it('replaces underscores with spaces in taskType', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('content_editing', context)

      expect(result).toContain('content editing assistant')
    })

    it('includes keyword and language', () => {
      const context = buildPromptContext(null, [], { keyword: 'delegation cee', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Target keyword: delegation cee')
      expect(result).toContain('Language: fr')
    })

    it('includes top 10 semantic terms sorted by importance', () => {
      const terms = [
        mockTerm({ term: 'low', display_term: 'low', importance: 0.5 }),
        mockTerm({ term: 'high', display_term: 'high', importance: 2.0 }),
        mockTerm({ term: 'medium', display_term: 'medium', importance: 1.0 }),
      ]
      const context = buildPromptContext(null, terms, { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Important semantic terms to incorporate:')
      expect(result).toContain('- high')
      expect(result).toContain('- medium')
      expect(result).toContain('- low')
    })

    it('includes terms to avoid', () => {
      const terms = [
        mockTerm({ term: 'cookies', display_term: 'cookies', is_to_avoid: true }),
        mockTerm({ term: 'expert', display_term: 'expert', is_to_avoid: true }),
      ]
      const context = buildPromptContext(null, terms, { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Terms to AVOID (not correlated with ranking):')
      expect(result).toContain('- cookies')
      expect(result).toContain('- expert')
    })

    it('includes audience if provided', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        { userContext: { audience: 'developers' } }
      )
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Target audience: developers')
    })

    it('includes tone in constraint if provided', () => {
      const context = buildPromptContext(
        null,
        [],
        { keyword: 'test', language: 'fr' },
        { userContext: { tone: 'professional' } }
      )
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Write in a professional tone.')
    })

    it('always includes over-optimization warning', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Do not exceed the semantic benchmarks')
      expect(result).toContain('Over-optimization (score > 100) should be avoided')
    })

    it('always includes focus on natural content', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).toContain('Focus on natural, high-quality content that serves the user intent.')
    })

    it('handles empty semanticTerms gracefully', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).not.toContain('Important semantic terms to incorporate:')
    })

    it('handles empty termsToAvoid gracefully', () => {
      const context = buildPromptContext(null, [], { keyword: 'test', language: 'fr' })
      const result = buildSystemMessage('plan_generation', context)

      expect(result).not.toContain('Terms to AVOID')
    })
  })
})
