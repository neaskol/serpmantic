import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  getScoreLabel,
  getScoreColor,
  calculateStructuralMetrics,
} from '../scoring'
import type { SemanticTerm } from '@/types/database'

// Helper to create mock semantic terms
const mockTerm = (overrides: Partial<SemanticTerm> = {}): SemanticTerm => ({
  id: 'term-1',
  serp_analysis_id: 'serp-1',
  term: 'energie',
  display_term: 'energie',
  is_main_keyword: false,
  min_occurrences: 3,
  max_occurrences: 8,
  importance: 1.0,
  term_type: 'unigram',
  is_to_avoid: false,
  ...overrides,
})

describe('Scoring', () => {
  describe('getScoreLabel', () => {
    it('returns "Mauvais" for scores 0-30', () => {
      expect(getScoreLabel(0)).toBe('Mauvais')
      expect(getScoreLabel(15)).toBe('Mauvais')
      expect(getScoreLabel(30)).toBe('Mauvais')
    })

    it('returns "Moyen" for scores 31-55', () => {
      expect(getScoreLabel(31)).toBe('Moyen')
      expect(getScoreLabel(45)).toBe('Moyen')
      expect(getScoreLabel(55)).toBe('Moyen')
    })

    it('returns "Bon" for scores 56-75', () => {
      expect(getScoreLabel(56)).toBe('Bon')
      expect(getScoreLabel(65)).toBe('Bon')
      expect(getScoreLabel(75)).toBe('Bon')
    })

    it('returns "Excellent" for scores 76-100', () => {
      expect(getScoreLabel(76)).toBe('Excellent')
      expect(getScoreLabel(90)).toBe('Excellent')
      expect(getScoreLabel(100)).toBe('Excellent')
    })

    it('returns "Sur-optimise" for scores > 100', () => {
      expect(getScoreLabel(101)).toBe('Sur-optimise')
      expect(getScoreLabel(110)).toBe('Sur-optimise')
      expect(getScoreLabel(120)).toBe('Sur-optimise')
    })
  })

  describe('getScoreColor', () => {
    it('returns red (#ef4444) for scores 0-30', () => {
      expect(getScoreColor(0)).toBe('#ef4444')
      expect(getScoreColor(30)).toBe('#ef4444')
    })

    it('returns orange (#f97316) for scores 31-55', () => {
      expect(getScoreColor(31)).toBe('#f97316')
      expect(getScoreColor(55)).toBe('#f97316')
    })

    it('returns yellow (#eab308) for scores 56-75', () => {
      expect(getScoreColor(56)).toBe('#eab308')
      expect(getScoreColor(75)).toBe('#eab308')
    })

    it('returns green (#22c55e) for scores 76-100', () => {
      expect(getScoreColor(76)).toBe('#22c55e')
      expect(getScoreColor(100)).toBe('#22c55e')
    })

    it('returns blue (#3b82f6) for scores > 100', () => {
      expect(getScoreColor(101)).toBe('#3b82f6')
      expect(getScoreColor(120)).toBe('#3b82f6')
    })
  })

  describe('calculateScore', () => {
    it('returns status "ok" with delta 0 for terms in range', () => {
      const term = mockTerm({ term: 'energie', min_occurrences: 3, max_occurrences: 8 })
      const text = 'energie energie energie energie energie' // 5 occurrences
      const result = calculateScore(text, [term])

      const termStatus = result.termStatuses.find((ts) => ts.term.term === 'energie')
      expect(termStatus?.count).toBe(5)
      expect(termStatus?.status).toBe('ok')
      expect(termStatus?.delta).toBe(0)
    })

    it('returns status "missing" with positive delta for terms below min', () => {
      const term = mockTerm({ term: 'energie', min_occurrences: 5, max_occurrences: 10 })
      const text = 'energie energie' // 2 occurrences
      const result = calculateScore(text, [term])

      const termStatus = result.termStatuses.find((ts) => ts.term.term === 'energie')
      expect(termStatus?.count).toBe(2)
      expect(termStatus?.status).toBe('missing')
      expect(termStatus?.delta).toBe(3) // Need 3 more to reach min of 5
    })

    it('returns status "excess" with negative delta for terms above max', () => {
      const term = mockTerm({ term: 'energie', min_occurrences: 3, max_occurrences: 5 })
      const text = 'energie energie energie energie energie energie energie energie' // 8 occurrences
      const result = calculateScore(text, [term])

      const termStatus = result.termStatuses.find((ts) => ts.term.term === 'energie')
      expect(termStatus?.count).toBe(8)
      expect(termStatus?.status).toBe('excess')
      expect(termStatus?.delta).toBe(-3) // 3 over the max of 5
    })

    it('calculates score capped at 120', () => {
      // Create many high-importance terms all in perfect range
      const terms = Array.from({ length: 20 }, (_, i) =>
        mockTerm({
          id: `term-${i}`,
          term: `term${i}`,
          min_occurrences: 1,
          max_occurrences: 3,
          importance: 10.0,
        })
      )

      // Text with all terms in range (2 occurrences each)
      const text = terms.map((t) => `${t.term} ${t.term}`).join(' ')

      const result = calculateScore(text, terms)
      expect(result.score).toBeLessThanOrEqual(120)
      expect(result.score).toBe(120) // Should be capped
    })

    it('returns score 0 for empty terms array', () => {
      const result = calculateScore('some text here', [])
      expect(result.score).toBe(0)
    })

    it('excludes is_to_avoid terms from scoring', () => {
      const goodTerm = mockTerm({ term: 'good', min_occurrences: 2, max_occurrences: 5, importance: 1.0 })
      const avoidTerm = mockTerm({
        term: 'cookies',
        min_occurrences: 0,
        max_occurrences: 0,
        importance: 1.0,
        is_to_avoid: true,
      })

      const text = 'good good good cookies cookies' // 3 good, 2 cookies
      const result = calculateScore(text, [goodTerm, avoidTerm])

      // Good term should be scored (in range)
      const goodStatus = result.termStatuses.find((ts) => ts.term.term === 'good')
      expect(goodStatus?.status).toBe('ok')

      // Avoid term should be tracked but NOT affect score
      const avoidStatus = result.termStatuses.find((ts) => ts.term.term === 'cookies')
      expect(avoidStatus?.count).toBe(2)
      expect(avoidStatus?.status).toBe('excess') // Present when it shouldn't be
      expect(avoidStatus?.delta).toBe(-2)
    })

    it('marks avoid terms as "ok" if absent, "excess" if present', () => {
      const avoidTerm = mockTerm({
        term: 'expert',
        min_occurrences: 0,
        max_occurrences: 0,
        importance: 1.0,
        is_to_avoid: true,
      })

      // Test when absent
      const result1 = calculateScore('some normal text', [avoidTerm])
      const status1 = result1.termStatuses.find((ts) => ts.term.term === 'expert')
      expect(status1?.status).toBe('ok')
      expect(status1?.count).toBe(0)

      // Test when present
      const result2 = calculateScore('text with expert expert', [avoidTerm])
      const status2 = result2.termStatuses.find((ts) => ts.term.term === 'expert')
      expect(status2?.status).toBe('excess')
      expect(status2?.count).toBe(2)
    })

    it('calculates weighted score based on term importance', () => {
      const highImportanceTerm = mockTerm({
        term: 'important',
        min_occurrences: 2,
        max_occurrences: 5,
        importance: 5.0,
      })
      const lowImportanceTerm = mockTerm({
        term: 'minor',
        min_occurrences: 1,
        max_occurrences: 3,
        importance: 1.0,
      })

      // Both terms in perfect range
      const text = 'important important important minor minor'
      const result = calculateScore(text, [highImportanceTerm, lowImportanceTerm])

      // Score should be high because both terms are in range
      expect(result.score).toBeGreaterThan(80)
    })

    it('handles normalized text matching', () => {
      const term = mockTerm({ term: 'energie', min_occurrences: 2, max_occurrences: 5 })
      // Input with accents and mixed case
      const text = 'Énergie ENERGIE énergie'
      const result = calculateScore(text, [term])

      const termStatus = result.termStatuses.find((ts) => ts.term.term === 'energie')
      expect(termStatus?.count).toBe(3) // All 3 variations should be counted
      expect(termStatus?.status).toBe('ok')
    })

    it('includes structuralMetrics in result', () => {
      const result = calculateScore('test text', [])
      expect(result.structuralMetrics).toEqual({
        words: 0,
        headings: 0,
        paragraphs: 0,
        links: 0,
        images: 0,
        videos: 0,
        tables: 0,
        lists: 0,
      })
    })
  })

  describe('calculateStructuralMetrics', () => {
    it('counts headings', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H2' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'H3' }] },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.headings).toBe(2)
    })

    it('counts paragraphs', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'P1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'P2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'P3' }] },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.paragraphs).toBe(3)
    })

    it('counts words from text nodes', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello world this is a test' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Another paragraph here' }] },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.words).toBe(9) // 6 + 3
    })

    it('counts links from marks', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link1',
                marks: [{ type: 'link', attrs: { href: 'http://example.com' } }],
              },
              {
                type: 'text',
                text: 'link2',
                marks: [{ type: 'link', attrs: { href: 'http://example.org' } }],
              },
            ],
          },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.links).toBe(2)
    })

    it('counts images', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'image1.jpg' } },
          { type: 'image', attrs: { src: 'image2.jpg' } },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.images).toBe(2)
    })

    it('counts videos (youtube and video types)', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'youtube', attrs: { src: 'https://youtube.com/watch?v=123' } },
          { type: 'video', attrs: { src: 'video.mp4' } },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.videos).toBe(2)
    })

    it('counts tables', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'table', content: [] },
          { type: 'table', content: [] },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.tables).toBe(2)
    })

    it('counts lists (bulletList and orderedList)', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'bulletList', content: [] },
          { type: 'orderedList', content: [] },
          { type: 'bulletList', content: [] },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.lists).toBe(3)
    })

    it('handles nested content structures', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello world' },
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: '#' } }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Item one' }],
                  },
                ],
              },
            ],
          },
        ],
      }

      const metrics = calculateStructuralMetrics(content)
      expect(metrics.paragraphs).toBe(2) // 1 top-level + 1 in list
      expect(metrics.words).toBe(5) // "Hello world link" = 3, "Item one" = 2, total 5
      expect(metrics.lists).toBe(1)
      expect(metrics.links).toBe(1)
    })

    it('returns zeros for empty document', () => {
      const content = { type: 'doc', content: [] }
      const metrics = calculateStructuralMetrics(content)

      expect(metrics).toEqual({
        words: 0,
        headings: 0,
        paragraphs: 0,
        links: 0,
        images: 0,
        videos: 0,
        tables: 0,
        lists: 0,
      })
    })

    it('handles content without type property gracefully', () => {
      const content = { content: [{ noType: true }] }
      const metrics = calculateStructuralMetrics(content)

      expect(metrics).toEqual({
        words: 0,
        headings: 0,
        paragraphs: 0,
        links: 0,
        images: 0,
        videos: 0,
        tables: 0,
        lists: 0,
      })
    })
  })
})
