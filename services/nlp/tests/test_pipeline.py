import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from pipeline import lemmatize_text, analyze_corpus, get_nlp


def test_lemmatize_french():
    tokens = lemmatize_text("Les energies renouvelables sont importantes", "fr")
    assert "energie" in tokens or "renouvelable" in tokens
    assert "les" not in tokens  # stopword removed


def test_analyze_corpus_returns_terms():
    texts = [
        "L'energie solaire est une source d'energie renouvelable tres importante pour la transition energetique.",
        "Les panneaux solaires permettent de capter l'energie du soleil pour produire de l'energie electrique.",
        "La transition energetique passe par le developpement de l'energie solaire et eolienne.",
    ]
    result = analyze_corpus(texts, "fr")
    assert "terms" in result
    assert "terms_to_avoid" in result
    assert len(result["terms"]) > 0

    # Check term structure
    first_term = result["terms"][0]
    assert "term" in first_term
    assert "min_occurrences" in first_term
    assert "max_occurrences" in first_term
    assert "importance" in first_term
    assert "term_type" in first_term


def test_analyze_corpus_empty():
    result = analyze_corpus([], "fr")
    assert result["terms"] == []


def test_analyze_single_document():
    """Test single document (should fail gracefully)"""
    result = analyze_corpus(["single text"], "fr")
    assert result["terms"] == []


def test_unsupported_language():
    """Test unsupported language"""
    with pytest.raises(ValueError, match="Unsupported language"):
        analyze_corpus(["test"], "xx")


@pytest.mark.parametrize("language", ["fr", "en", "it", "de", "es"])
def test_model_loading(language):
    """Test spaCy model loading for all languages"""
    nlp = get_nlp(language)
    assert nlp is not None
    assert nlp.lang in ["fr", "en", "it", "de", "es"]


def test_performance():
    """Test analysis completes in reasonable time"""
    import time
    texts = ["sample text for testing performance"] * 10
    start = time.time()
    result = analyze_corpus(texts, "fr")
    duration = time.time() - start

    assert duration < 5.0  # Must complete in < 5s
    assert len(result["terms"]) > 0
