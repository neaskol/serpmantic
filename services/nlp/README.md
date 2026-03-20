# SERPmantics NLP Service

Service d'analyse sémantique pour SERPmantics.

## Version simplifiée (MVP)

Cette version utilise du traitement de texte basique sans ML pour faciliter le déploiement gratuit sur Render.com.

### Fonctionnalités

- ✅ Tokenisation et normalisation de texte
- ✅ Extraction de n-grammes (uni/bi/trigrams)
- ✅ Calcul de fréquences et percentiles
- ✅ Identification de termes significatifs
- ✅ Détection de termes à éviter
- ✅ Support multilingue (FR, EN, IT, DE, ES)

### Différences avec la version ML complète

**Version actuelle (simplifié)** :
- Pas de lemmatisation (ex: "courir", "cours", "courant" sont traités séparément)
- Stopwords fixes (pas de modèle linguistique)
- TF-IDF simplifié basé sur fréquences brutes

**Version ML complète** (nécessite plus de ressources) :
- spaCy pour lemmatisation (ex: "courir" = "cours" = "courant")
- Modèles linguistiques avancés
- TF-IDF avec scikit-learn

### API

**Endpoints** :
- `GET /health` - Health check basique
- `GET /health/ready` - Readiness check
- `POST /analyze` - Analyse sémantique

**Exemple de requête** :
```json
{
  "texts": [
    "Premier texte à analyser...",
    "Second texte à analyser..."
  ],
  "language": "fr"
}
```

**Réponse** :
```json
{
  "terms": [
    {
      "term": "seo",
      "display_term": "seo",
      "min_occurrences": 2,
      "max_occurrences": 5,
      "importance": 8.5,
      "term_type": "unigram"
    }
  ],
  "terms_to_avoid": ["cookie", "menu"]
}
```

### Déploiement sur Render

1. Root Directory: `services/nlp`
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Migration vers version ML (future)

Pour activer la version ML complète :

1. Ajouter dans requirements.txt :
```
spacy==3.7.5
scikit-learn==1.5.0
numpy>=1.26.0,<2.0.0
```

2. Télécharger les modèles spaCy :
```bash
python -m spacy download fr_core_news_sm
python -m spacy download en_core_web_sm
```

3. Remplacer `pipeline.py` par la version ML

⚠️ **Attention** : La version ML nécessite :
- Plus de RAM (512 MB minimum → 1 GB recommandé)
- Plus d'espace disque (100 MB → 500 MB)
- Temps de démarrage plus long (5s → 30s)
