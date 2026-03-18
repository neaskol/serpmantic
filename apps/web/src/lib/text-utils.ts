/**
 * Normalize text: lowercase + remove accents (diacritics)
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Count non-overlapping occurrences of a term in text.
 * Both text and term should already be normalized.
 */
export function countOccurrences(text: string, term: string): number {
  if (!term || !text) return 0

  let count = 0
  let pos = 0

  while ((pos = text.indexOf(term, pos)) !== -1) {
    // Check word boundaries to avoid partial matches
    const before = pos === 0 ? ' ' : text[pos - 1]
    const after = pos + term.length >= text.length ? ' ' : text[pos + term.length]

    const isWordBoundaryBefore = /\s|[.,;:!?()[\]{}"']/.test(before) || pos === 0
    const isWordBoundaryAfter = /\s|[.,;:!?()[\]{}"']/.test(after) || pos + term.length === text.length

    if (isWordBoundaryBefore && isWordBoundaryAfter) {
      count++
    }
    pos += term.length
  }

  return count
}
