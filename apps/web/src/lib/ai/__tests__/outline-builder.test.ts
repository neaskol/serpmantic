import { describe, it, expect } from 'vitest'
import {
  buildOutlinePrompt,
  validateOutlineHierarchy,
  parseOutlineResponse,
} from '../outline-builder'
import type { ExtractedHeading, OutlineSection } from '@/types/database'

// Helper to create mock headings
const mockHeading = (level: number, text: string): ExtractedHeading => ({
  level,
  text,
  position: 0,
})

describe('Outline Builder', () => {
  describe('buildOutlinePrompt', () => {
    it('includes keyword in task description', () => {
      const prompt = buildOutlinePrompt('delegation cee', [], [])

      expect(prompt).toContain('delegation cee')
      expect(prompt).toContain('Generate an optimal H2/H3 content outline')
    })

    it('includes competitor headings when > 2 headings available', () => {
      const competitors = [
        {
          url: 'https://example.com',
          title: 'Example Title',
          headings: [
            mockHeading(2, 'What is delegation?'),
            mockHeading(3, 'Benefits'),
            mockHeading(3, 'Process'),
          ],
        },
      ]

      const prompt = buildOutlinePrompt('delegation', competitors, [])

      expect(prompt).toContain('<competitor_headings>')
      expect(prompt).toContain('https://example.com')
      expect(prompt).toContain('Example Title')
      expect(prompt).toContain('H2: What is delegation?')
      expect(prompt).toContain('H3: Benefits')
      expect(prompt).toContain('H3: Process')
    })

    it('falls back to titles when <= 2 headings', () => {
      const competitors = [
        {
          url: 'https://example.com',
          title: 'Example Title',
          headings: [mockHeading(2, 'Single heading')],
        },
      ]

      const prompt = buildOutlinePrompt('test', competitors, [])

      expect(prompt).toContain('<competitor_titles>')
      expect(prompt).toContain('Heading data not available')
      expect(prompt).toContain('https://example.com')
      expect(prompt).toContain('Example Title')
      expect(prompt).not.toContain('<competitor_headings>')
    })

    it('includes top semantic terms as numbered list', () => {
      const topTerms = ['energie', 'delegation', 'certificat']
      const prompt = buildOutlinePrompt('test', [], topTerms)

      expect(prompt).toContain('<semantic_terms>')
      expect(prompt).toContain('1. energie')
      expect(prompt).toContain('2. delegation')
      expect(prompt).toContain('3. certificat')
    })

    it('includes SEO guidelines', () => {
      const prompt = buildOutlinePrompt('test', [], [])

      expect(prompt).toContain('<guidelines>')
      expect(prompt).toContain('Generate 4-8 H2 sections')
      expect(prompt).toContain('Each H2 can have 0-4 H3 subsections')
      expect(prompt).toContain('Maintain strict hierarchy: H2 → H3')
    })

    it('includes anti-patterns with keyword substitution', () => {
      const prompt = buildOutlinePrompt('SEO optimization', [], [])

      expect(prompt).toContain('<anti_patterns>')
      expect(prompt).toContain('BAD (generic):')
      expect(prompt).toContain('Introduction to SEO optimization')
      expect(prompt).toContain('GOOD (specific to SEO optimization):')
    })

    it('includes output format specification', () => {
      const prompt = buildOutlinePrompt('test', [], [])

      expect(prompt).toContain('<output_format>')
      expect(prompt).toContain('Return ONLY valid JSON')
      expect(prompt).toContain('"level": "h2"')
      expect(prompt).toContain('"title": "Heading text"')
      expect(prompt).toContain('"keywords"')
    })

    it('handles multiple competitors with headings (requires > 2 headings each)', () => {
      const competitors = [
        {
          url: 'https://site1.com',
          title: 'Site 1',
          headings: [
            mockHeading(2, 'H2 One'),
            mockHeading(3, 'H3 One'),
            mockHeading(3, 'H3 One-Two'),
          ],
        },
        {
          url: 'https://site2.com',
          title: 'Site 2',
          headings: [
            mockHeading(2, 'H2 Two'),
            mockHeading(3, 'H3 Two'),
            mockHeading(3, 'H3 Two-Two'),
          ],
        },
      ]

      const prompt = buildOutlinePrompt('test', competitors, [])

      expect(prompt).toContain('<competitor_headings>')
      expect(prompt).toContain('https://site1.com')
      expect(prompt).toContain('https://site2.com')
      expect(prompt).toContain('H2: H2 One')
      expect(prompt).toContain('H2: H2 Two')
    })
  })

  describe('validateOutlineHierarchy', () => {
    it('returns false for empty array', () => {
      expect(validateOutlineHierarchy([])).toBe(false)
    })

    it('returns false if first item is h3', () => {
      const outline: OutlineSection[] = [
        { level: 'h3', title: 'Subsection', keywords: [] },
      ]

      expect(validateOutlineHierarchy(outline)).toBe(false)
    })

    it('returns false if h3 appears before any h2', () => {
      const outline: OutlineSection[] = [
        { level: 'h3', title: 'Bad subsection', keywords: [] },
        { level: 'h2', title: 'Main section', keywords: [] },
      ]

      expect(validateOutlineHierarchy(outline)).toBe(false)
    })

    it('returns true for valid h2-only outline', () => {
      const outline: OutlineSection[] = [
        { level: 'h2', title: 'Section 1', keywords: [] },
        { level: 'h2', title: 'Section 2', keywords: [] },
      ]

      expect(validateOutlineHierarchy(outline)).toBe(true)
    })

    it('returns true for valid h2-then-h3 sequence', () => {
      const outline: OutlineSection[] = [
        { level: 'h2', title: 'Main', keywords: [] },
        { level: 'h3', title: 'Sub 1', keywords: [] },
        { level: 'h3', title: 'Sub 2', keywords: [] },
        { level: 'h2', title: 'Another main', keywords: [] },
      ]

      expect(validateOutlineHierarchy(outline)).toBe(true)
    })

    it('returns true for complex valid hierarchy', () => {
      const outline: OutlineSection[] = [
        { level: 'h2', title: 'A', keywords: [] },
        { level: 'h3', title: 'A1', keywords: [] },
        { level: 'h3', title: 'A2', keywords: [] },
        { level: 'h2', title: 'B', keywords: [] },
        { level: 'h2', title: 'C', keywords: [] },
        { level: 'h3', title: 'C1', keywords: [] },
      ]

      expect(validateOutlineHierarchy(outline)).toBe(true)
    })
  })

  describe('parseOutlineResponse', () => {
    it('parses clean JSON array', () => {
      const response = JSON.stringify([
        { level: 'h2', title: 'Main Section', keywords: ['keyword1', 'keyword2'] },
        { level: 'h3', title: 'Subsection', keywords: ['keyword3'] },
      ])

      const result = parseOutlineResponse(response)

      expect(result).toEqual([
        { level: 'h2', title: 'Main Section', keywords: ['keyword1', 'keyword2'] },
        { level: 'h3', title: 'Subsection', keywords: ['keyword3'] },
      ])
    })

    it('strips markdown code fences with json', () => {
      const response = '```json\n[{"level": "h2", "title": "Test", "keywords": []}]\n```'

      const result = parseOutlineResponse(response)

      expect(result).toEqual([{ level: 'h2', title: 'Test', keywords: [] }])
    })

    it('strips markdown code fences without language', () => {
      const response = '```\n[{"level": "h2", "title": "Test", "keywords": []}]\n```'

      const result = parseOutlineResponse(response)

      expect(result).toEqual([{ level: 'h2', title: 'Test', keywords: [] }])
    })

    it('validates level is h2 or h3', () => {
      const response = JSON.stringify([{ level: 'h1', title: 'Bad', keywords: [] }])

      expect(() => parseOutlineResponse(response)).toThrow('invalid level: h1')
    })

    it('validates title is non-empty string', () => {
      const response = JSON.stringify([{ level: 'h2', title: '', keywords: [] }])

      expect(() => parseOutlineResponse(response)).toThrow('invalid title')
    })

    it('validates title exists', () => {
      const response = JSON.stringify([{ level: 'h2', keywords: [] }])

      expect(() => parseOutlineResponse(response)).toThrow('invalid title')
    })

    it('validates keywords is an array', () => {
      const response = JSON.stringify([{ level: 'h2', title: 'Test', keywords: 'not-array' }])

      expect(() => parseOutlineResponse(response)).toThrow('invalid keywords: not an array')
    })

    it('validates keywords contains only strings', () => {
      const response = JSON.stringify([{ level: 'h2', title: 'Test', keywords: ['valid', 123] }])

      expect(() => parseOutlineResponse(response)).toThrow('non-string keyword')
    })

    it('throws on invalid JSON', () => {
      const response = '{invalid json}'

      expect(() => parseOutlineResponse(response)).toThrow('Failed to parse JSON')
    })

    it('throws if response is not an array', () => {
      const response = '{"level": "h2", "title": "Test", "keywords": []}'

      expect(() => parseOutlineResponse(response)).toThrow('Response is not an array')
    })

    it('throws if array item is not an object', () => {
      const response = '["string-item"]'

      expect(() => parseOutlineResponse(response)).toThrow('is not an object')
    })

    it('handles multiple sections correctly', () => {
      const response = JSON.stringify([
        { level: 'h2', title: 'Section 1', keywords: ['a', 'b'] },
        { level: 'h3', title: 'Section 1.1', keywords: ['c'] },
        { level: 'h2', title: 'Section 2', keywords: ['d', 'e', 'f'] },
      ])

      const result = parseOutlineResponse(response)

      expect(result).toHaveLength(3)
      expect(result[0].keywords).toEqual(['a', 'b'])
      expect(result[2].keywords).toEqual(['d', 'e', 'f'])
    })
  })
})
