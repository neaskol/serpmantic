"""
Simplified NLP pipeline without spaCy for lightweight deployment.
Uses basic text processing instead of ML models.
"""
import re
from collections import Counter
import logging

logger = logging.getLogger(__name__)

# Simple stopwords lists
STOPWORDS = {
    'fr': {'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'de', 'du', 'pour', 'dans', 'sur', 'avec', 'par', 'ce', 'qui', 'que', 'est', 'sont', 'a', 'au', 'aux'},
    'en': {'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been'},
    'it': {'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'o', 'di', 'da', 'in', 'con', 'su', 'per', 'che', 'è', 'sono'},
    'de': {'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'von', 'zu', 'in', 'an', 'auf', 'mit', 'für', 'ist', 'sind'},
    'es': {'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'es', 'son'},
}


def normalize_text(text: str) -> str:
    """Basic text normalization."""
    # Lowercase
    text = text.lower()
    # Remove accents (basic)
    accents = str.maketrans(
        'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
        'aaaaaaeeeeiiiiooooouuuuyync'
    )
    text = text.translate(accents)
    # Remove punctuation except spaces
    text = re.sub(r'[^\w\s]', ' ', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def tokenize(text: str, language: str) -> list[str]:
    """Simple tokenization with stopword removal."""
    normalized = normalize_text(text)
    words = normalized.split()
    stopwords = STOPWORDS.get(language, set())
    return [w for w in words if w not in stopwords and len(w) > 2]


def extract_ngrams(tokens: list[str], n: int) -> list[str]:
    """Extract n-grams from tokens."""
    return [' '.join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def calculate_term_frequencies(texts: list[str], language: str) -> dict[str, list[int]]:
    """Calculate term frequencies across all documents."""
    all_terms = {}

    for text in texts:
        tokens = tokenize(text, language)

        # Unigrams
        for term in tokens:
            if term not in all_terms:
                all_terms[term] = []

        # Bigrams
        bigrams = extract_ngrams(tokens, 2)
        for term in bigrams:
            if term not in all_terms:
                all_terms[term] = []

        # Trigrams
        trigrams = extract_ngrams(tokens, 3)
        for term in trigrams:
            if term not in all_terms:
                all_terms[term] = []

    # Count occurrences per document
    for term in all_terms:
        for text in texts:
            tokens = tokenize(text, language)
            text_normalized = ' '.join(tokens)
            count = text_normalized.count(term)
            all_terms[term].append(count)

    return all_terms


def analyze_corpus(texts: list[str], language: str) -> dict:
    """
    Analyze a corpus of SERP page texts.
    Returns semantic terms with occurrence ranges.
    """
    # Validate inputs
    if not texts:
        logger.warning("Empty corpus provided")
        return {"terms": [], "terms_to_avoid": []}

    if language not in ["fr", "en", "it", "de", "es"]:
        raise ValueError(f"Unsupported language: {language}")

    if len(texts) < 2:
        logger.warning("Not enough documents for analysis")
        return {"terms": [], "terms_to_avoid": []}

    # Calculate term frequencies
    term_frequencies = calculate_term_frequencies(texts, language)

    # Filter significant terms (appear in at least 40% of docs)
    min_doc_freq = max(2, int(len(texts) * 0.4))
    significant_terms = {}

    for term, freqs in term_frequencies.items():
        doc_freq = sum(1 for f in freqs if f > 0)
        if doc_freq >= min_doc_freq:
            significant_terms[term] = freqs

    # Build term objects
    terms = []
    for term, freqs in significant_terms.items():
        freqs_array = [f for f in freqs if f > 0]
        if not freqs_array:
            continue

        # Calculate percentiles
        sorted_freqs = sorted(freqs_array)
        p10_idx = max(0, int(len(sorted_freqs) * 0.1))
        p90_idx = min(len(sorted_freqs) - 1, int(len(sorted_freqs) * 0.9))

        min_occ = sorted_freqs[p10_idx]
        max_occ = sorted_freqs[p90_idx]

        # Calculate importance (based on average frequency)
        avg_freq = sum(freqs) / len(texts)
        importance = round(avg_freq * 10, 2)

        # Determine term type
        word_count = len(term.split())
        if word_count == 1:
            term_type = "unigram"
        elif word_count == 2:
            term_type = "bigram"
        elif word_count == 3:
            term_type = "trigram"
        else:
            term_type = "phrase"

        terms.append({
            "term": term,
            "display_term": term,
            "min_occurrences": max(0, min_occ),
            "max_occurrences": max(min_occ, max_occ),
            "importance": importance,
            "term_type": term_type,
        })

    # Sort by importance
    terms.sort(key=lambda t: t["importance"], reverse=True)

    # Terms to avoid: high frequency but appear in all docs (generic terms)
    terms_to_avoid = []
    for term, freqs in term_frequencies.items():
        if len(term.split()) == 1:  # Only unigrams
            doc_freq = sum(1 for f in freqs if f > 0)
            if doc_freq == len(texts):  # Appears in ALL docs
                avg_freq = sum(freqs) / len(texts)
                if avg_freq > 5:  # High frequency
                    terms_to_avoid.append(term)

    return {
        "terms": terms[:100],  # Cap at 100
        "terms_to_avoid": terms_to_avoid[:20],  # Cap at 20
    }
