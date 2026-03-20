import { describe, it, expect } from 'vitest'
import { extractJSON } from '../json-extractor'

describe('JSON Extractor', () => {
  describe('Strategy 1: Direct parse', () => {
    it('parses clean JSON string', () => {
      const input = '{"test": 1, "value": "hello"}'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1, value: 'hello' })
    })

    it('parses JSON with whitespace', () => {
      const input = '  \n  {"test": 1}  \n  '
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('parses nested objects', () => {
      const input = '{"outer": {"inner": {"deep": 42}}}'
      const result = extractJSON(input)

      expect(result).toEqual({ outer: { inner: { deep: 42 } } })
    })

    it('parses arrays', () => {
      const input = '[{"a": 1}, {"b": 2}]'
      const result = extractJSON(input)

      expect(result).toEqual([{ a: 1 }, { b: 2 }])
    })
  })

  describe('Strategy 2: Markdown code block extraction', () => {
    it('extracts from ```json code block', () => {
      const input = '```json\n{"test": 1}\n```'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('extracts from ``` code block without language', () => {
      const input = '```\n{"test": 1}\n```'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('handles extra whitespace in code block', () => {
      const input = '```json\n\n  {"test": 1}  \n\n```'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('handles multiline JSON in code block', () => {
      const input = '```json\n{\n  "test": 1,\n  "value": "hello"\n}\n```'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1, value: 'hello' })
    })
  })

  describe('Strategy 3: JSON embedded in text', () => {
    it('extracts JSON from text prefix', () => {
      const input = 'Here is the result: {"test": 1}'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('extracts JSON from text suffix', () => {
      const input = '{"test": 1} as requested'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('extracts JSON surrounded by text', () => {
      const input = 'Some text before {"test": 1} and after'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })

    it('extracts JSON when multiple objects present (greedy match from first to last brace)', () => {
      // Note: The regex is greedy and will match from first { to last }
      // So this will try to parse the whole string from {"a": 1} to {"b": 2}
      // which is invalid JSON and will fall through to error
      const input = 'First: {"a": 1} Second: {"b": 2}'

      // This should actually fail because {"a": 1} Second: {"b": 2} is not valid JSON
      expect(() => extractJSON(input)).toThrow('No valid JSON found')
    })

    it('extracts first complete JSON object from text', () => {
      const input = 'Here is: {"test": 1}'
      const result = extractJSON(input)

      expect(result).toEqual({ test: 1 })
    })
  })

  describe('Edge cases', () => {
    it('handles JSON with special characters', () => {
      const input = '{"text": "Hello \\"world\\"", "emoji": "🚀"}'
      const result = extractJSON(input)

      expect(result).toEqual({ text: 'Hello "world"', emoji: '🚀' })
    })

    it('handles JSON with newlines in strings', () => {
      const input = '{"text": "Line 1\\nLine 2"}'
      const result = extractJSON(input)

      expect(result).toEqual({ text: 'Line 1\nLine 2' })
    })

    it('handles empty object', () => {
      const input = '{}'
      const result = extractJSON(input)

      expect(result).toEqual({})
    })

    it('handles empty array', () => {
      const input = '[]'
      const result = extractJSON(input)

      expect(result).toEqual([])
    })
  })

  describe('Error cases', () => {
    it('throws on plain text with no JSON', () => {
      expect(() => extractJSON('This is just text')).toThrow('No valid JSON found')
    })

    it('throws on malformed JSON', () => {
      expect(() => extractJSON('{invalid json}')).toThrow('No valid JSON found')
    })

    it('throws on empty string', () => {
      expect(() => extractJSON('')).toThrow('No valid JSON found')
    })

    it('throws on incomplete JSON object', () => {
      expect(() => extractJSON('{"test": 1')).toThrow('No valid JSON found')
    })

    it('throws on JSON-like text without valid structure', () => {
      expect(() => extractJSON('{ this is not json }')).toThrow('No valid JSON found')
    })
  })
})
