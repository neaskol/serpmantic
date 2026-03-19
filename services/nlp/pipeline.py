import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from languages import get_model_name
import logging

logger = logging.getLogger(__name__)

# Cache loaded models
_models: dict[str, spacy.Language] = {}


def get_nlp(language: str) -> spacy.Language:
    if language not in _models:
        model_name = get_model_name(language)
        _models[language] = spacy.load(model_name)
    return _models[language]


def lemmatize_text(text: str, language: str) -> list[str]:
    """Tokenize + lemmatize + remove stopwords and punctuation."""
    nlp = get_nlp(language)
    doc = nlp(text)
    return [
        token.lemma_.lower()
        for token in doc
        if not token.is_stop and not token.is_punct and not token.is_space and len(token.lemma_) > 1
    ]


def extract_ngrams(tokens: list[str], n: int) -> list[str]:
    """Extract n-grams from a list of tokens."""
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def analyze_corpus(texts: list[str], language: str) -> dict:
    """
    Analyze a corpus of SERP page texts.
    Returns semantic terms with occurrence ranges and terms to avoid.
    """
    # Validate inputs
    if not texts:
        logger.warning("Empty corpus provided")
        return {"terms": [], "terms_to_avoid": []}

    if language not in ["fr", "en", "it", "de", "es"]:
        raise ValueError(f"Unsupported language: {language}")

    try:
        nlp = get_nlp(language)
    except Exception as e:
        logger.error(f"Failed to load spaCy model for {language}: {e}")
        raise ValueError(f"Language model not available: {language}")

    # Lemmatize all texts
    lemmatized_texts = []
    all_tokens_per_doc = []

    for i, text in enumerate(texts):
        try:
            tokens = lemmatize_text(text, language)
            if not tokens:
                logger.warning(f"Document {i} produced no tokens")
                continue
            lemmatized_texts.append(" ".join(tokens))
            all_tokens_per_doc.append(tokens)
        except Exception as e:
            logger.error(f"Failed to lemmatize document {i}: {e}")
            continue

    if len(lemmatized_texts) < 2:
        logger.warning("Not enough valid documents for TF-IDF analysis")
        return {"terms": [], "terms_to_avoid": []}

    # TF-IDF to find significant terms
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=200,
        min_df=2,  # term must appear in at least 2 docs
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(lemmatized_texts)
    except ValueError:
        # Not enough documents
        return {"terms": [], "terms_to_avoid": []}

    feature_names = vectorizer.get_feature_names_out()
    mean_tfidf = np.array(tfidf_matrix.mean(axis=0)).flatten()

    # Select significant terms (above median TF-IDF)
    threshold = np.median(mean_tfidf[mean_tfidf > 0])
    significant_indices = np.where(mean_tfidf > threshold)[0]

    terms = []
    for idx in significant_indices:
        term = feature_names[idx]
        tfidf_score = float(mean_tfidf[idx])

        # Count occurrences in each document
        occurrences = []
        for tokens in all_tokens_per_doc:
            doc_text = " ".join(tokens)
            count = doc_text.count(term)
            occurrences.append(count)

        occurrences_arr = np.array(occurrences)
        p10 = int(np.percentile(occurrences_arr, 10))
        p90 = int(np.percentile(occurrences_arr, 90))

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
            "min_occurrences": max(0, p10),
            "max_occurrences": max(p10, p90),
            "importance": round(tfidf_score * 10, 2),
            "term_type": term_type,
        })

    # Sort by importance descending
    terms.sort(key=lambda t: t["importance"], reverse=True)

    # Terms to avoid: high raw frequency but low TF-IDF
    low_tfidf_indices = np.where(
        (mean_tfidf > 0) & (mean_tfidf <= threshold)
    )[0]

    terms_to_avoid = []
    for idx in low_tfidf_indices:
        term = feature_names[idx]
        # Only single words as avoid terms
        if len(term.split()) == 1:
            raw_freq = sum(
                " ".join(tokens).count(term) for tokens in all_tokens_per_doc
            )
            if raw_freq > len(texts) * 2:  # appears frequently but low TF-IDF
                terms_to_avoid.append(term)

    return {
        "terms": terms[:100],  # Cap at 100 terms
        "terms_to_avoid": terms_to_avoid[:20],  # Cap at 20
    }
