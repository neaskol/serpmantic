import { describe, it, expect } from 'vitest'
import { normalizeText, countOccurrences } from '../text-utils'

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('removes accents', () => {
    expect(normalizeText('énergie rénovation')).toBe('energie renovation')
  })

  it('handles mixed case and accents', () => {
    expect(normalizeText('Délégataire CEE')).toBe('delegataire cee')
  })
})

describe('countOccurrences', () => {
  it('counts unigram occurrences', () => {
    const text = 'energie solaire et energie eolienne et energie nucleaire'
    expect(countOccurrences(text, 'energie')).toBe(3)
  })

  it('counts bigram occurrences', () => {
    const text = 'renovation energetique et renovation energetique des batiments'
    expect(countOccurrences(text, 'renovation energetique')).toBe(2)
  })

  it('is case and accent insensitive', () => {
    const text = 'Énergie renouvelable et énergie solaire'
    expect(countOccurrences(normalizeText(text), 'energie')).toBe(2)
  })

  it('returns 0 when term not found', () => {
    expect(countOccurrences('hello world', 'foo')).toBe(0)
  })

  it('counts trigram occurrences', () => {
    const text = 'certificats d economies d energie pour les certificats d economies d energie'
    expect(countOccurrences(text, 'certificats d economies d energie')).toBe(2)
  })
})
