import { describe, it, expect } from 'vitest'
import { aggregateNlpResults } from '../nlp-aggregator'

describe('aggregateNlpResults', () => {
  it('returns empty terms for empty input', () => {
    const result = aggregateNlpResults([])
    expect(result.terms).toEqual([])
    expect(result.terms_to_avoid).toEqual([])
  })

  it('returns empty terms for single document', () => {
    const result = aggregateNlpResults([['energie', 'solaire']])
    expect(result.terms).toEqual([])
  })

  it('extracts significant terms present in 40%+ of docs', () => {
    // 'energie' appears in 3/3 docs, 'solaire' in 2/3, 'nucleaire' in 1/3
    const lemmaLists = [
      ['energie', 'energie', 'solaire', 'nucleaire'],
      ['energie', 'solaire', 'energie'],
      ['energie', 'eolien'],
    ]
    const result = aggregateNlpResults(lemmaLists)

    const termNames = result.terms.map(t => t.term)
    expect(termNames).toContain('energie') // 3/3 docs = 100%
    expect(termNames).toContain('solaire') // 2/3 docs = 66%
    expect(termNames).not.toContain('nucleaire') // 1/3 docs = 33% < 40%
  })

  it('calculates min/max occurrence ranges', () => {
    const lemmaLists = [
      ['energie', 'energie', 'energie'], // 3 occurrences
      ['energie', 'energie'],             // 2 occurrences
      ['energie'],                         // 1 occurrence
    ]
    const result = aggregateNlpResults(lemmaLists)
    const energieTerm = result.terms.find(t => t.term === 'energie')

    expect(energieTerm).toBeDefined()
    expect(energieTerm!.min_occurrences).toBeGreaterThanOrEqual(1)
    expect(energieTerm!.max_occurrences).toBeLessThanOrEqual(3)
  })

  it('identifies bigrams and trigrams', () => {
    const lemmaLists = [
      ['energie', 'renouvelable', 'energie', 'renouvelable'],
      ['energie', 'renouvelable', 'energie', 'renouvelable'],
      ['energie', 'renouvelable'],
    ]
    const result = aggregateNlpResults(lemmaLists)
    const bigramTerm = result.terms.find(t => t.term === 'energie renouvelable')

    expect(bigramTerm).toBeDefined()
    expect(bigramTerm!.term_type).toBe('bigram')
  })

  it('identifies terms to avoid (high-freq unigrams in all docs)', () => {
    const lemmaLists = [
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
    ]
    const result = aggregateNlpResults(lemmaLists)
    expect(result.terms_to_avoid).toContain('cookie')
  })

  it('caps output at 100 terms and 20 terms_to_avoid', () => {
    // Generate many unique terms across 3 docs
    const makeLemmas = (prefix: string) => {
      const lemmas: string[] = []
      for (let i = 0; i < 150; i++) {
        lemmas.push(`${prefix}${i}`)
      }
      return lemmas
    }
    // All same terms in all docs so they pass 40% threshold
    const sharedLemmas = makeLemmas('term')
    const lemmaLists = [sharedLemmas, sharedLemmas, sharedLemmas]
    const result = aggregateNlpResults(lemmaLists)

    expect(result.terms.length).toBeLessThanOrEqual(100)
    expect(result.terms_to_avoid.length).toBeLessThanOrEqual(20)
  })
})
