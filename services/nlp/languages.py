SPACY_MODELS = {
    "fr": "fr_core_news_md",
    "en": "en_core_web_md",
}

def get_model_name(language: str) -> str:
    return SPACY_MODELS.get(language, "en_core_web_md")
