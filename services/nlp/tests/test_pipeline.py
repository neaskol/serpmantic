import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import lemmatize_text, analyze_corpus


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
