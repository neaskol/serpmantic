import { describe, it, expect } from 'vitest'
import { calculateScore, getScoreLabel, getScoreColor } from '../scoring'
import type { SemanticTerm } from '@/types/database'

const mockTerms: SemanticTerm[] = [
  {
    id: '1', serp_analysis_id: 'sa1', term: 'energie', display_term: 'énergie',
    is_main_keyword: true, min_occurrences: 5, max_occurrences: 10,
    importance: 2.0, term_type: 'unigram', is_to_avoid: false,
  },
  {
    id: '2', serp_analysis_id: 'sa1', term: 'renovation energetique', display_term: 'rénovation énergétique',
    is_main_keyword: false, min_occurrences: 2, max_occurrences: 5,
    importance: 1.5, term_type: 'bigram', is_to_avoid: false,
  },
  {
    id: '3', serp_analysis_id: 'sa1', term: 'cookies', display_term: 'cookies',
    is_main_keyword: false, min_occurrences: 0, max_occurrences: 0,
    importance: 1.0, term_type: 'unigram', is_to_avoid: true,
  },
]

describe('calculateScore', () => {
  it('returns 0 for empty text', () => {
    const result = calculateScore('', mockTerms)
    expect(result.score).toBe(0)
  })

  it('returns perfect score when all terms are in range', () => {
    const text = 'energie energie energie energie energie energie energie renovation energetique renovation energetique renovation energetique'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBe(120)
  })

  it('returns partial score when terms are below range', () => {
    const text = 'energie energie'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(120)
  })

  it('caps score at 120', () => {
    const text = 'energie energie energie energie energie energie energie renovation energetique renovation energetique renovation energetique'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBeLessThanOrEqual(120)
  })

  it('penalizes over-optimized terms', () => {
    const text = Array(15).fill('energie').join(' ')
    const result = calculateScore(text, mockTerms)
    const normalText = Array(7).fill('energie').join(' ')
    const normalResult = calculateScore(normalText, mockTerms)
    expect(result.score).toBeLessThan(normalResult.score)
  })

  it('excludes is_to_avoid terms from scoring', () => {
    const result = calculateScore('energie energie energie energie energie', mockTerms)
    const termStatuses = result.termStatuses
    const avoidTerm = termStatuses.find(t => t.term.is_to_avoid)
    expect(avoidTerm).toBeDefined()
  })

  it('reports correct term statuses', () => {
    const text = 'energie energie energie'
    const result = calculateScore(text, mockTerms)
    const energieStatus = result.termStatuses.find(t => t.term.term === 'energie')
    expect(energieStatus?.status).toBe('missing')
    expect(energieStatus?.count).toBe(3)
    expect(energieStatus?.delta).toBe(2)
  })
})

describe('getScoreLabel', () => {
  it('returns Mauvais for 0-30', () => {
    expect(getScoreLabel(15)).toBe('Mauvais')
  })
  it('returns Moyen for 31-55', () => {
    expect(getScoreLabel(45)).toBe('Moyen')
  })
  it('returns Bon for 56-75', () => {
    expect(getScoreLabel(65)).toBe('Bon')
  })
  it('returns Excellent for 76-100', () => {
    expect(getScoreLabel(90)).toBe('Excellent')
  })
  it('returns Sur-optimise for 101-120', () => {
    expect(getScoreLabel(110)).toBe('Sur-optimise')
  })
})

describe('getScoreColor', () => {
  it('returns red for Mauvais', () => {
    expect(getScoreColor(15)).toBe('#ef4444')
  })
  it('returns blue for Sur-optimise', () => {
    expect(getScoreColor(110)).toBe('#3b82f6')
  })
})
