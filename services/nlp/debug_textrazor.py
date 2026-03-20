"""Debug script to check TextRazor raw output."""
import os
import textrazor
import certifi
from dotenv import load_dotenv

load_dotenv()

# Configure SSL
os.environ['SSL_CERT_FILE'] = certifi.where()

# Set API key
textrazor.api_key = os.getenv("TEXTRAZOR_API_KEY")

# Test text
text = """
Les délégataires CEE sont des acteurs essentiels du dispositif des Certificats
d'Économies d'Énergie. Un délégataire CEE accompagne les particuliers et les
entreprises dans leurs projets de rénovation énergétique.
"""

print("Testing TextRazor API...")
print("=" * 80)

try:
    client = textrazor.TextRazor(extractors=["words", "entities", "topics"])
    client.set_language_override("fre")

    response = client.analyze(text)

    print(f"\n✅ Analysis successful!")
    print(f"\n📝 Words found: {len(list(response.words())) if response.words() else 0}")

    if response.words():
        print("\nFirst 20 words with attributes:")
        print("-" * 80)
        for i, word in enumerate(list(response.words())[:20]):
            print(f"{i+1:2d}. {word.__dict__}")

    print(f"\n🏷️  Entities found: {len(list(response.entities())) if response.entities() else 0}")
    if response.entities():
        for entity in list(response.entities())[:10]:
            print(f"  - {entity.matched_text} ({entity.freebase_types[0] if entity.freebase_types else 'unknown'})")

    print(f"\n📚 Topics found: {len(list(response.topics())) if response.topics() else 0}")
    if response.topics():
        for topic in list(response.topics())[:10]:
            print(f"  - {topic.label} (score: {topic.score:.2f})")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
