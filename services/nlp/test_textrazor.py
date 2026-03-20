"""
Test script for TextRazor integration.
"""
import os
from dotenv import load_dotenv
from textrazor_pipeline import analyze_corpus

# Load environment variables
load_dotenv()

# Sample SERP texts (French - "délé gataire CEE")
sample_texts = [
    """
    Les délégataires CEE sont des acteurs essentiels du dispositif des Certificats
    d'Économies d'Énergie. Un délégataire CEE accompagne les particuliers et les
    entreprises dans leurs projets de rénovation énergétique. Pour devenir délégataire
    CEE, il faut obtenir une délégation auprès du Pôle National des Certificats
    d'Économies d'Énergie. Les délégataires peuvent valoriser les CEE obtenus
    grâce aux travaux d'économies d'énergie réalisés.
    """,
    """
    Le rôle du délégataire CEE consiste à collecter et valoriser les certificats
    d'économies d'énergie. Les délégataires CEE travaillent avec les obligés (fournisseurs
    d'énergie) pour financer les travaux de rénovation énergétique. Opera Energie est
    un exemple de délégataire CEE reconnu. La délégation CEE permet de bénéficier de
    primes énergie pour les travaux d'isolation, de chauffage ou de ventilation.
    """,
    """
    Devenir délégataire CEE nécessite une expertise en rénovation énergétique et une
    connaissance approfondie du dispositif CEE. Les délégataires doivent s'enregistrer
    auprès du ministère de la transition écologique. Le statut de délégataire CEE offre
    l'opportunité de financer des projets d'économies d'énergie via les certificats CEE.
    Les obligations des délégataires incluent la vérification des travaux et la transmission
    des dossiers au Pôle National.
    """
]

def test_textrazor():
    """Test TextRazor analysis with sample French texts."""
    print("=" * 80)
    print("Testing TextRazor NLP Pipeline")
    print("=" * 80)

    # Check API key
    api_key = os.getenv("TEXTRAZOR_API_KEY")
    if not api_key:
        print("❌ ERROR: TEXTRAZOR_API_KEY not found in environment")
        return

    print(f"✅ API Key loaded: {api_key[:20]}...")
    print(f"📄 Analyzing {len(sample_texts)} sample texts (French)")
    print()

    try:
        # Run analysis
        result = analyze_corpus(sample_texts, language="fr")

        print(f"✅ Analysis completed successfully!")
        print()
        print(f"📊 Results:")
        print(f"  - {len(result['terms'])} significant terms found")
        print(f"  - {len(result['terms_to_avoid'])} terms to avoid")
        print()

        # Display top 10 terms
        print("🔝 Top 10 Terms:")
        print("-" * 80)
        for i, term in enumerate(result['terms'][:10], 1):
            print(f"{i:2d}. {term['term']:30s} | Type: {term['term_type']:8s} | "
                  f"Range: {term['min_occurrences']}-{term['max_occurrences']} | "
                  f"Importance: {term['importance']:.1f}")

        print()
        print("⚠️  Terms to Avoid:")
        print("-" * 80)
        for term in result['terms_to_avoid'][:5]:
            print(f"  - {term}")

        print()
        print("=" * 80)
        print("✅ Test PASSED - TextRazor integration working correctly!")
        print("=" * 80)

    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_textrazor()
