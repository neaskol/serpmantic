import { describe, it, expect } from 'vitest'
import { normalizeText, countOccurrences } from '../text-utils'

describe('Text Utils', () => {
  describe('normalizeText', () => {
    it('converts text to lowercase', () => {
      expect(normalizeText('HELLO WORLD')).toBe('hello world')
      expect(normalizeText('MiXeD CaSe')).toBe('mixed case')
    })

    it('removes diacritics from accented characters', () => {
      expect(normalizeText('café')).toBe('cafe')
      expect(normalizeText('déjà')).toBe('deja')
      expect(normalizeText('naïve')).toBe('naive')
      expect(normalizeText('São Paulo')).toBe('sao paulo')
    })

    it('handles French accents correctly', () => {
      expect(normalizeText('Énergie')).toBe('energie')
      expect(normalizeText('délégation')).toBe('delegation')
      expect(normalizeText('économie')).toBe('economie')
      expect(normalizeText('coût')).toBe('cout')
    })

    it('uses NFD decomposition for normalization', () => {
      // NFD decomposition separates base character from combining diacritics
      expect(normalizeText('Ñoño')).toBe('nono')
      expect(normalizeText('Göttingen')).toBe('gottingen')
      expect(normalizeText('Zürich')).toBe('zurich')
    })

    it('handles already normalized text', () => {
      expect(normalizeText('hello world')).toBe('hello world')
      expect(normalizeText('seo optimization')).toBe('seo optimization')
    })

    it('handles empty string', () => {
      expect(normalizeText('')).toBe('')
    })

    it('handles text with numbers and punctuation', () => {
      expect(normalizeText('Test123!')).toBe('test123!')
      expect(normalizeText('Hello, world.')).toBe('hello, world.')
    })

    it('preserves spaces and structure', () => {
      expect(normalizeText('Multiple   spaces')).toBe('multiple   spaces')
      expect(normalizeText('Line\nBreak')).toBe('line\nbreak')
    })
  })

  describe('countOccurrences', () => {
    it('counts non-overlapping word-boundary matches', () => {
      const text = normalizeText('the cat sat on the mat')
      expect(countOccurrences(text, 'the')).toBe(2)
      expect(countOccurrences(text, 'cat')).toBe(1)
      expect(countOccurrences(text, 'sat')).toBe(1)
    })

    it('respects word boundaries - does not match partial words', () => {
      const text = normalizeText('energy bioenergy renewable')
      // 'energy' should match standalone 'energy' but NOT inside 'bioenergy'
      expect(countOccurrences(text, 'energy')).toBe(1)
    })

    it('handles punctuation as word boundary', () => {
      const text = normalizeText('Hello, world. Hello!')
      expect(countOccurrences(text, 'hello')).toBe(2)

      const text2 = normalizeText('Test (energy) and energy.')
      expect(countOccurrences(text2, 'energy')).toBe(2)
    })

    it('returns 0 for empty term', () => {
      expect(countOccurrences('some text', '')).toBe(0)
    })

    it('returns 0 for empty text', () => {
      expect(countOccurrences('', 'term')).toBe(0)
    })

    it('returns 0 when term not found', () => {
      const text = normalizeText('hello world')
      expect(countOccurrences(text, 'missing')).toBe(0)
    })

    it('handles term at start of text', () => {
      const text = normalizeText('energie is important')
      expect(countOccurrences(text, 'energie')).toBe(1)
    })

    it('handles term at end of text', () => {
      const text = normalizeText('important energie')
      expect(countOccurrences(text, 'energie')).toBe(1)
    })

    it('handles multiple consecutive occurrences with word boundaries', () => {
      const text = normalizeText('test test test')
      expect(countOccurrences(text, 'test')).toBe(3)
    })

    it('handles multi-word terms (phrases)', () => {
      const text = normalizeText('economies d energie and economies d energie again')
      expect(countOccurrences(text, 'economies d energie')).toBe(2)
    })

    it('is case-insensitive when used with normalizeText', () => {
      const text = normalizeText('Energy ENERGY energy')
      expect(countOccurrences(text, 'energy')).toBe(3)
    })

    it('handles normalized French terms', () => {
      const text = normalizeText('La délégation CEE et la délégation.')
      const normalizedTerm = normalizeText('délégation')
      expect(countOccurrences(text, normalizedTerm)).toBe(2)
    })

    it('handles quoted text', () => {
      const text = normalizeText('"energie" and "energie" again')
      expect(countOccurrences(text, 'energie')).toBe(2)
    })

    it('handles brackets as word boundaries', () => {
      const text = normalizeText('[test] {test} (test)')
      expect(countOccurrences(text, 'test')).toBe(3)
    })

    it('does not count overlapping matches (word boundary enforcement)', () => {
      // The countOccurrences function uses word boundaries, so 'aa' won't match in 'aaa'
      // because there's no word boundary between the 'a's
      const text = normalizeText('aaa')
      expect(countOccurrences(text, 'aa')).toBe(0)

      // But it will match in proper word-separated context
      const text2 = normalizeText('aa and aa again')
      expect(countOccurrences(text2, 'aa')).toBe(2)
    })
  })

  describe('Integration: normalizeText + countOccurrences', () => {
    it('handles real-world French SEO content', () => {
      const content = `
        Les certificats d'économies d'énergie (CEE) sont un dispositif français.
        Le délégataire CEE aide les entreprises à obtenir des certificats d'économies d'énergie.
        La délégation CEE est une pratique courante dans le secteur de l'énergie.
      `
      const normalizedContent = normalizeText(content)
      const normalizedTerm = normalizeText('certificats d\'économies d\'énergie')

      // Should find "certificats d'économies d'énergie" twice (with normalized accents)
      expect(countOccurrences(normalizedContent, normalizedTerm)).toBe(2)
    })

    it('matches terms regardless of original case or accents', () => {
      const content = 'ÉNERGIE Energie énergie energie'
      const normalizedContent = normalizeText(content)
      const normalizedTerm = normalizeText('énergie')

      expect(countOccurrences(normalizedContent, normalizedTerm)).toBe(4)
    })
  })
})
