"""
NLP pipeline using TextRazor API for advanced semantic analysis.
Provides lemmatization, entity extraction, and topic analysis.
"""
import textrazor
import os
import logging
import ssl
import certifi
from collections import defaultdict
from typing import Dict, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Configure SSL for macOS
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

# Initialize TextRazor client
TEXTRAZOR_API_KEY = os.getenv("TEXTRAZOR_API_KEY")
if not TEXTRAZOR_API_KEY:
    raise ValueError("TEXTRAZOR_API_KEY not found in environment variables")

textrazor.api_key = TEXTRAZOR_API_KEY


def analyze_text_with_textrazor(text: str, language: str) -> dict:
    """
    Analyze a single text with TextRazor.
    Returns lemmatized tokens (stems), entities, and topics.
    """
    try:
        # Create client with extractors
        client = textrazor.TextRazor(extractors=["words", "entities", "topics"])

        # Set language
        lang_map = {
            "fr": "fre",
            "en": "eng",
            "it": "ita",
            "de": "deu",
            "es": "spa"
        }
        client.set_language_override(lang_map.get(language, "eng"))

        # Analyze text
        response = client.analyze(text)

        # Extract stems (lemmas) from words with POS filtering
        lemmas = []
        if response.words():
            for word in response.words():
                # Access the json dict for word attributes
                word_data = word.json if hasattr(word, 'json') else {}
                stem = word_data.get('stem', '')
                pos = word_data.get('partOfSpeech', '')

                # Keep only content words (nouns, verbs, adjectives)
                # Filter out stopwords and punctuation
                if (stem and
                    len(stem) > 2 and
                    pos in ["NOUN", "PROPN", "VERB", "ADJ", "ADV"]):
                    lemmas.append(stem.lower())

        # Extract entities
        entities = []
        if response.entities():
            entities = [
                {
                    "text": entity.matched_text,
                    "type": entity.freebase_types[0] if entity.freebase_types else "unknown",
                    "relevance": entity.relevance_score
                }
                for entity in response.entities()
            ]

        # Extract topics
        topics = []
        if response.topics():
            topics = [
                {
                    "label": topic.label,
                    "score": topic.score
                }
                for topic in response.topics()
            ]

        return {
            "lemmas": lemmas,
            "entities": entities,
            "topics": topics
        }

    except textrazor.TextRazorAnalysisException as e:
        logger.error(f"TextRazor analysis error: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in TextRazor analysis: {e}")
        raise


def extract_ngrams(tokens: List[str], n: int) -> List[str]:
    """Extract n-grams from tokens."""
    if len(tokens) < n:
        return []
    return [' '.join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def calculate_term_frequencies(lemma_lists: List[List[str]]) -> Dict[str, List[int]]:
    """
    Calculate term frequencies across all documents.
    Returns term -> [count_in_doc1, count_in_doc2, ...]
    """
    all_terms = defaultdict(list)

    # Process each document
    for doc_lemmas in lemma_lists:
        # Count terms in this document
        doc_term_counts = defaultdict(int)

        # Unigrams
        for lemma in doc_lemmas:
            doc_term_counts[lemma] += 1

        # Bigrams
        bigrams = extract_ngrams(doc_lemmas, 2)
        for bigram in bigrams:
            doc_term_counts[bigram] += 1

        # Trigrams
        trigrams = extract_ngrams(doc_lemmas, 3)
        for trigram in trigrams:
            doc_term_counts[trigram] += 1

        # Add counts to all_terms
        # First pass: collect all unique terms
        for term in doc_term_counts.keys():
            if term not in all_terms:
                # Initialize with zeros for previous documents
                all_terms[term] = [0] * (len(lemma_lists) - 1)

        # Add counts for current document
        for term in all_terms.keys():
            all_terms[term].append(doc_term_counts.get(term, 0))

    # Ensure all lists have the same length
    num_docs = len(lemma_lists)
    for term in all_terms:
        while len(all_terms[term]) < num_docs:
            all_terms[term].append(0)

    return dict(all_terms)


def analyze_corpus(texts: List[str], language: str = "fr") -> dict:
    """
    Analyze a corpus of SERP page texts using TextRazor.
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

    logger.info(f"Analyzing {len(texts)} documents with TextRazor (language: {language})")

    # Analyze each text with TextRazor
    lemma_lists = []
    all_entities = []

    for i, text in enumerate(texts):
        try:
            # Truncate to 200KB if needed (TextRazor limit)
            max_bytes = 200 * 1024
            text_bytes = text.encode('utf-8')
            if len(text_bytes) > max_bytes:
                text = text_bytes[:max_bytes].decode('utf-8', errors='ignore')
                logger.warning(f"Document {i+1} truncated to 200KB")

            result = analyze_text_with_textrazor(text, language)
            lemma_lists.append(result["lemmas"])
            all_entities.extend(result["entities"])

            logger.info(f"Document {i+1}/{len(texts)}: {len(result['lemmas'])} lemmas extracted")

        except Exception as e:
            logger.error(f"Failed to analyze document {i+1}: {e}")
            # Continue with empty lemmas for this document
            lemma_lists.append([])

    # Calculate term frequencies
    term_frequencies = calculate_term_frequencies(lemma_lists)

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

        # Calculate percentiles (P10-P90)
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

    logger.info(f"Analysis complete: {len(terms)} significant terms, {len(terms_to_avoid)} terms to avoid")

    return {
        "terms": terms[:100],  # Cap at 100
        "terms_to_avoid": terms_to_avoid[:20],  # Cap at 20
    }
