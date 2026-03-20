/**
 * Local NLP aggregation logic — mirrors the Python pipeline's
 * term frequency calculation so we can reconstruct analysis
 * from cached per-URL lemma lists without calling TextRazor.
 */

interface AggregatedTerm {
  term: string
  display_term: string
  min_occurrences: number
  max_occurrences: number
  importance: number
  term_type: 'unigram' | 'bigram' | 'trigram' | 'phrase'
}

function extractNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return []
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '))
  }
  return ngrams
}

function calculateTermFrequencies(
  lemmaLists: string[][]
): Map<string, number[]> {
  const allTerms = new Map<string, number[]>()
  const numDocs = lemmaLists.length

  for (let docIdx = 0; docIdx < numDocs; docIdx++) {
    const docLemmas = lemmaLists[docIdx]
    const docTermCounts = new Map<string, number>()

    // Unigrams
    for (const lemma of docLemmas) {
      docTermCounts.set(lemma, (docTermCounts.get(lemma) || 0) + 1)
    }

    // Bigrams
    for (const bigram of extractNgrams(docLemmas, 2)) {
      docTermCounts.set(bigram, (docTermCounts.get(bigram) || 0) + 1)
    }

    // Trigrams
    for (const trigram of extractNgrams(docLemmas, 3)) {
      docTermCounts.set(trigram, (docTermCounts.get(trigram) || 0) + 1)
    }

    // Initialize new terms with zeros for previous docs
    for (const term of docTermCounts.keys()) {
      if (!allTerms.has(term)) {
        allTerms.set(term, new Array(docIdx).fill(0))
      }
    }

    // Add counts for current doc
    for (const [term, counts] of allTerms) {
      counts.push(docTermCounts.get(term) || 0)
    }
  }

  // Pad short arrays
  for (const [, counts] of allTerms) {
    while (counts.length < numDocs) {
      counts.push(0)
    }
  }

  return allTerms
}

export function aggregateNlpResults(
  lemmaLists: string[][]
): { terms: AggregatedTerm[]; terms_to_avoid: string[] } {
  if (lemmaLists.length < 2) {
    return { terms: [], terms_to_avoid: [] }
  }

  const termFrequencies = calculateTermFrequencies(lemmaLists)
  const numDocs = lemmaLists.length
  const minDocFreq = Math.max(2, Math.floor(numDocs * 0.4))

  // Filter significant terms
  const terms: AggregatedTerm[] = []

  for (const [term, freqs] of termFrequencies) {
    const docFreq = freqs.filter(f => f > 0).length
    if (docFreq < minDocFreq) continue

    const nonZeroFreqs = freqs.filter(f => f > 0).sort((a, b) => a - b)
    if (nonZeroFreqs.length === 0) continue

    const p10Idx = Math.max(0, Math.floor(nonZeroFreqs.length * 0.1))
    const p90Idx = Math.min(
      nonZeroFreqs.length - 1,
      Math.floor(nonZeroFreqs.length * 0.9)
    )

    const minOcc = nonZeroFreqs[p10Idx]
    const maxOcc = nonZeroFreqs[p90Idx]
    const avgFreq = freqs.reduce((a, b) => a + b, 0) / numDocs
    const importance = Math.round(avgFreq * 10 * 100) / 100

    const wordCount = term.split(' ').length
    let termType: AggregatedTerm['term_type']
    if (wordCount === 1) termType = 'unigram'
    else if (wordCount === 2) termType = 'bigram'
    else if (wordCount === 3) termType = 'trigram'
    else termType = 'phrase'

    terms.push({
      term,
      display_term: term,
      min_occurrences: Math.max(0, minOcc),
      max_occurrences: Math.max(minOcc, maxOcc),
      importance,
      term_type: termType,
    })
  }

  // Sort by importance descending
  terms.sort((a, b) => b.importance - a.importance)

  // Terms to avoid
  const termsToAvoid: string[] = []
  for (const [term, freqs] of termFrequencies) {
    if (term.split(' ').length !== 1) continue
    const docFreq = freqs.filter(f => f > 0).length
    if (docFreq === numDocs) {
      const avgFreq = freqs.reduce((a, b) => a + b, 0) / numDocs
      if (avgFreq > 5) {
        termsToAvoid.push(term)
      }
    }
  }

  return {
    terms: terms.slice(0, 100),
    terms_to_avoid: termsToAvoid.slice(0, 20),
  }
}
