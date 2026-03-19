/**
 * JSON Extractor: Robust JSON parsing from LLM responses
 *
 * LLMs often wrap JSON in markdown code blocks or add extra text.
 * This utility tries multiple extraction strategies to find valid JSON.
 *
 * Strategy:
 * 1. Try direct JSON.parse (for clean responses)
 * 2. Extract from markdown code blocks: ```json ... ```
 * 3. Find first {...} object in text
 * 4. Throw if no valid JSON found
 *
 * @module json-extractor
 */

/**
 * Extract JSON from LLM response text
 *
 * @param text - Raw text from LLM (may contain markdown, extra text)
 * @returns Parsed JSON object
 * @throws Error if no valid JSON found
 *
 * @example
 * ```typescript
 * // Clean JSON
 * extractJSON('{"test": 1}') // → {test: 1}
 *
 * // Markdown-wrapped JSON
 * extractJSON('```json\n{"test": 1}\n```') // → {test: 1}
 *
 * // JSON embedded in text
 * extractJSON('Here is the result: {"test": 1} as requested') // → {test: 1}
 * ```
 */
export function extractJSON(text: string): unknown {
  // Strategy 1: Try direct parse (clean responses)
  try {
    return JSON.parse(text.trim())
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown code block
  // Matches: ```json {...} ``` or ``` {...} ```
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find first {...} object in text
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      // Continue to throw
    }
  }

  // No valid JSON found
  throw new Error('No valid JSON found in AI response')
}
