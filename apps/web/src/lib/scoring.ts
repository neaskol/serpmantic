import type { SemanticTerm, TermStatus, ScoreLabel, ScoreResult, StructuralMetrics } from '@/types/database'
import { normalizeText, countOccurrences } from './text-utils'

export function calculateScore(rawText: string, terms: SemanticTerm[]): ScoreResult {
  const text = normalizeText(rawText)

  const scorableTerms = terms.filter(t => !t.is_to_avoid)
  const avoidTerms = terms.filter(t => t.is_to_avoid)

  let totalWeightedScore = 0
  let totalImportance = 0

  const termStatuses: TermStatus[] = []

  // Score scorable terms
  for (const term of scorableTerms) {
    const count = countOccurrences(text, term.term)
    let termScore: number

    if (count < term.min_occurrences) {
      // Below range: partial score proportional to progress
      termScore = term.min_occurrences === 0 ? 1.0 : (count / term.min_occurrences)
    } else if (count <= term.max_occurrences) {
      // In range: full score
      termScore = 1.0
    } else {
      // Above range: penalty
      const excess = count - term.max_occurrences
      termScore = Math.max(0.3, 1.0 - excess * 0.1)
    }

    totalWeightedScore += termScore * term.importance
    totalImportance += term.importance

    let status: 'ok' | 'missing' | 'excess'
    let delta: number

    if (count < term.min_occurrences) {
      status = 'missing'
      delta = term.min_occurrences - count
    } else if (count > term.max_occurrences) {
      status = 'excess'
      delta = term.max_occurrences - count // negative
    } else {
      status = 'ok'
      delta = 0
    }

    termStatuses.push({ term, count, status, delta })
  }

  // Track avoid terms (not scored)
  for (const term of avoidTerms) {
    const count = countOccurrences(text, term.term)
    termStatuses.push({
      term,
      count,
      status: count > 0 ? 'excess' : 'ok',
      delta: count > 0 ? -count : 0,
    })
  }

  const rawScore = totalImportance > 0
    ? (totalWeightedScore / totalImportance) * 120
    : 0
  const score = Math.min(120, Math.round(rawScore))

  return {
    score,
    label: getScoreLabel(score),
    color: getScoreColor(score),
    termStatuses,
    structuralMetrics: { words: 0, headings: 0, paragraphs: 0, links: 0, images: 0, videos: 0, tables: 0, lists: 0 },
  }
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score <= 30) return 'Mauvais'
  if (score <= 55) return 'Moyen'
  if (score <= 75) return 'Bon'
  if (score <= 100) return 'Excellent'
  return 'Sur-optimise'
}

export function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'  // red
  if (score <= 55) return '#f97316'  // orange
  if (score <= 75) return '#eab308'  // yellow
  if (score <= 100) return '#22c55e' // green
  return '#3b82f6'                   // blue
}

/**
 * Calculate structural metrics from TipTap JSON content
 */
export function calculateStructuralMetrics(content: Record<string, unknown>): StructuralMetrics {
  const metrics: StructuralMetrics = {
    words: 0, headings: 0, paragraphs: 0, links: 0,
    images: 0, videos: 0, tables: 0, lists: 0,
  }

  function traverse(node: Record<string, unknown>) {
    const type = node.type as string | undefined
    if (!type) return

    switch (type) {
      case 'heading': metrics.headings++; break
      case 'paragraph': metrics.paragraphs++; break
      case 'bulletList':
      case 'orderedList': metrics.lists++; break
      case 'table': metrics.tables++; break
      case 'image': metrics.images++; break
      case 'youtube':
      case 'video': metrics.videos++; break
      case 'text':
        if (typeof node.text === 'string') {
          metrics.words += node.text.trim().split(/\s+/).filter(Boolean).length
        }
        break
    }

    // Check marks for links
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if ((mark as Record<string, unknown>).type === 'link') metrics.links++
      }
    }

    // Recurse into children
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child as Record<string, unknown>)
      }
    }
  }

  traverse(content)
  return metrics
}
