import type { OutlineSection, ExtractedHeading } from '@/types/database'

/**
 * Build the AI prompt for generating content outlines
 *
 * Uses XML-structured format optimized for Claude models.
 * Analyzes competitor headings and semantic terms to generate
 * a comprehensive H2/H3 outline.
 *
 * @param keyword - Target keyword for the content
 * @param competitors - SERP pages with optional extracted headings
 * @param topTerms - Top semantic terms to distribute across sections
 * @returns Formatted prompt string for Claude
 */
export function buildOutlinePrompt(
  keyword: string,
  competitors: Array<{ url: string; title: string; headings: ExtractedHeading[] }>,
  topTerms: string[]
): string {
  // Filter competitors with meaningful headings
  const competitorsWithHeadings = competitors.filter((c) => c.headings.length > 2)

  // Build competitor section
  let competitorSection = ''
  if (competitorsWithHeadings.length > 0) {
    competitorSection = `<competitor_headings>
${competitorsWithHeadings
  .map(
    (c) =>
      `URL: ${c.url}
Title: ${c.title}
Headings:
${c.headings
  .map((h) => `${h.level === 2 ? 'H2' : 'H3'}: ${h.text}`)
  .join('\n')}`
  )
  .join('\n\n')}
</competitor_headings>`
  } else {
    // If no headings available, provide titles for context
    competitorSection = `<competitor_titles>
Note: Heading data not available for these pages. Use titles as context.
${competitors.map((c) => `${c.url}\nTitle: ${c.title}`).join('\n\n')}
</competitor_titles>`
  }

  const prompt = `<task>
Generate an optimal H2/H3 content outline for the following keyword: "${keyword}"

The outline should be comprehensive, cover all key semantic topics, and follow SEO best practices.
Generate headings in the same language as the keyword.
</task>

${competitorSection}

<semantic_terms>
Top semantic terms to distribute across sections (aim for 2-4 terms per section):
${topTerms.map((term, idx) => `${idx + 1}. ${term}`).join('\n')}
</semantic_terms>

<guidelines>
1. Generate 4-8 H2 sections (main topics)
2. Each H2 can have 0-4 H3 subsections (supporting topics)
3. Each section should cover a distinct aspect of the keyword
4. Headings should be specific and actionable (answer user questions)
5. Distribute semantic terms naturally across sections
6. Use specific, descriptive headings (not generic like "Introduction" or "Conclusion")
7. Maintain strict hierarchy: H2 → H3, never skip levels
8. Prioritize topics that appear in multiple competitor headings
</guidelines>

<anti_patterns>
BAD (generic):
- H2: Introduction to ${keyword}
- H2: What is ${keyword}?
- H2: Conclusion

GOOD (specific to ${keyword}):
- H2: [Concrete aspect or question about ${keyword}]
- H2: [Specific benefit or use case of ${keyword}]
- H2: [Actionable guide related to ${keyword}]
</anti_patterns>

<output_format>
Return ONLY valid JSON. No markdown code fences, no explanations.

Array of objects with this structure:
[
  {
    "level": "h2",
    "title": "Heading text",
    "keywords": ["term1", "term2", "term3"]
  },
  {
    "level": "h3",
    "title": "Subheading text",
    "keywords": ["term4", "term5"]
  }
]

Each section must have:
- level: "h2" or "h3" (string)
- title: heading text (string)
- keywords: 2-4 semantic terms from the list above (array of strings)
</output_format>`

  return prompt
}

/**
 * Validate outline hierarchy structure
 *
 * Ensures:
 * - Outline is not empty
 * - First item is H2 (not H3)
 * - No H3 appears before any H2
 *
 * @param outline - Generated outline sections
 * @returns true if valid hierarchy, false otherwise
 */
export function validateOutlineHierarchy(outline: OutlineSection[]): boolean {
  if (outline.length === 0) {
    return false
  }

  if (outline[0].level !== 'h2') {
    return false
  }

  let hasSeenH2 = false
  for (const section of outline) {
    if (section.level === 'h2') {
      hasSeenH2 = true
    } else if (section.level === 'h3' && !hasSeenH2) {
      return false
    }
  }

  return true
}

/**
 * Parse and validate LLM outline response
 *
 * Handles:
 * - Markdown code fences (```json...```)
 * - JSON validation
 * - Field validation (level, title, keywords)
 *
 * @param responseText - Raw LLM response text
 * @returns Parsed outline sections
 * @throws Error if response is malformed or invalid
 */
export function parseOutlineResponse(responseText: string): OutlineSection[] {
  // Strip markdown code fences
  const cleanedText = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleanedText)
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not an array')
  }

  const outline: OutlineSection[] = []

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]

    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${i} is not an object`)
    }

    const { level, title, keywords } = item as Record<string, unknown>

    if (level !== 'h2' && level !== 'h3') {
      throw new Error(`Item at index ${i} has invalid level: ${level}. Expected "h2" or "h3"`)
    }

    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error(`Item at index ${i} has invalid title: ${title}`)
    }

    if (!Array.isArray(keywords)) {
      throw new Error(`Item at index ${i} has invalid keywords: not an array`)
    }

    for (const keyword of keywords) {
      if (typeof keyword !== 'string') {
        throw new Error(`Item at index ${i} has non-string keyword: ${keyword}`)
      }
    }

    outline.push({
      level: level as 'h2' | 'h3',
      title,
      keywords: keywords as string[],
    })
  }

  return outline
}
