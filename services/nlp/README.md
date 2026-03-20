# SERPmantics NLP Service

Service d'analyse sémantique pour SERPmantics utilisant **TextRazor API**.

## Version TextRazor (Production)

Cette version utilise l'API TextRazor pour une analyse NLP professionnelle avec lemmatisation multilingue.

### Fonctionnalités

- ✅ **Lemmatisation avancée** via TextRazor (ex: "délégataires" → "délégatair")
- ✅ Extraction d'entités nommées (personnes, organisations, lieux)
- ✅ Analyse de topics sémantiques
- ✅ Part-of-speech tagging (NOUN, VERB, ADJ, ADV, PROPN)
- ✅ Extraction de n-grammes (uni/bi/trigrams)
- ✅ Calcul de fréquences et percentiles (P10-P90)
- ✅ Identification de termes significatifs
- ✅ Détection de termes à éviter
- ✅ Support multilingue (FR, EN, IT, DE, ES)

### Avantages vs version basique

**TextRazor (version actuelle)** :
- ✅ Lemmatisation complète ("délégataires" = "délégataire" = "délégué")
- ✅ Reconnaissance d'entités ("CEE" = organisation)
- ✅ Analyse sémantique avancée
- ✅ Pas de modèle ML à héberger (API cloud)

**Version basique (ancienne)** :
- ❌ Pas de lemmatisation ("courir" ≠ "cours" ≠ "courant")
- ❌ Stopwords fixes
- ❌ TF-IDF simplifié

### Configuration

Créer un fichier `.env` :

```env
TEXTRAZOR_API_KEY=votre-clé-api-textrazor
PORT=8080
```

### API

**Endpoints** :
- `GET /health` - Health check basique
- `GET /health/ready` - Readiness check
- `POST /analyze` - Analyse sémantique avec TextRazor

**Exemple de requête** :
```json
{
  "texts": [
    "Les délégataires CEE sont des acteurs essentiels...",
    "Le rôle du délégataire CEE consiste à collecter..."
  ],
  "language": "fr"
}
```

**Réponse** :
```json
{
  "terms": [
    {
      "term": "délégatair",
      "display_term": "délégatair",
      "min_occurrences": 3,
      "max_occurrences": 4,
      "importance": 36.7,
      "term_type": "unigram"
    },
    {
      "term": "économ énerg",
      "display_term": "économ énerg",
      "min_occurrences": 1,
      "max_occurrences": 3,
      "importance": 16.7,
      "term_type": "bigram"
    }
  ],
  "terms_to_avoid": ["cookie", "menu", "footer"]
}
```

### Installation locale

```bash
# Créer un environnement virtuel
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Créer le fichier .env avec votre clé TextRazor
echo "TEXTRAZOR_API_KEY=votre-clé" > .env

# Tester l'intégration
python test_textrazor.py

# Lancer le serveur
uvicorn main:app --reload --port 8080
```

### Déploiement sur Render.com

1. **Root Directory**: `services/nlp`
2. **Build Command**: `pip install -r requirements.txt`
3. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**:
   - `TEXTRAZOR_API_KEY` = votre clé API TextRazor
   - `PORT` = $PORT (défini automatiquement par Render)

### Limites TextRazor

- **Free tier** : 500 requêtes/jour
- **Limite de taille** : 200 KB de texte par requête
- **Requêtes concurrentes** : 2 max (free tier)

### Monitoring

Le service log automatiquement :
- Nombre de documents analysés
- Nombre de termes extraits
- Temps de traitement
- Erreurs TextRazor

Consultez les logs avec :
```bash
# Render.com
Logs > Services > serpmantic-nlp

# Local
uvicorn main:app --log-level debug
```

### Fallback en cas d'échec

Si TextRazor est indisponible, le service utilise automatiquement le pipeline basique (`pipeline.py`) comme fallback.
