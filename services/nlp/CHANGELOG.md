# Changelog - Service NLP

## [2.0.0] - 2026-03-20

### Added - TextRazor Integration

- ✅ **Migration complète vers TextRazor API** pour lemmatisation professionnelle
- ✅ **Nouveau endpoint `/textrazor/usage`** pour monitoring du quota API
- ✅ **Tracking in-memory** des requêtes TextRazor (reset quotidien à minuit UTC)
- ✅ **Support multilingue avancé** : FR, EN, IT, DE, ES avec lemmatisation native
- ✅ **Extraction d'entités nommées** (organisations, lieux, personnes)
- ✅ **Analyse de topics sémantiques** pour enrichir les résultats
- ✅ **POS tagging Universal Dependencies** (NOUN, PROPN, VERB, ADJ, ADV)

### Changed

- **Pipeline NLP** : Remplacement de `pipeline.py` par `textrazor_pipeline.py`
- **main.py** : Import de `textrazor_pipeline.analyze_corpus` au lieu de `pipeline.analyze_corpus`
- **main.py** : Ajout de `track_textrazor_request()` incrémentant le compteur à chaque `/analyze`
- **requirements.txt** : Versioning flexible (`>=` au lieu de `==`) pour éviter les conflits de dépendances

### Dependencies

Nouvelles dépendances ajoutées :
- `textrazor>=1.4.1` : Client Python officiel TextRazor
- `python-dotenv>=1.0.0` : Chargement des variables d'environnement depuis `.env`
- `certifi` : Certificats SSL pour macOS (fix SSL_CERT_FILE)

### Fixed

- ✅ **SSL Certificate Verification** : Configuration automatique de `SSL_CERT_FILE` et `REQUESTS_CA_BUNDLE` via certifi
- ✅ **Lemmatisation** : Correction de l'accès aux attributs des objets `Word` de TextRazor (utilisation de `word.json` dict)
- ✅ **POS tags** : Migration vers tags Universal Dependencies (NOUN/VERB/ADJ au lieu de NN/VB/JJ)

### Configuration Required

**Variable d'environnement obligatoire** :
```env
TEXTRAZOR_API_KEY=983cfb36d574b5cc112c69a2574a900d1252c8882b32a39eae002ebe
```

**Configuration Render.com** :
1. Dashboard → Service `serpmantic-nlp` → Environment
2. Add Environment Variable : `TEXTRAZOR_API_KEY`
3. Save Changes → Le service redémarre automatiquement

### Deployment

**Render.com** :
```yaml
Name: serpmantic-nlp
Environment: Python 3
Region: Frankfurt (EU Central)
Branch: main
Root Directory: services/nlp
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Variables d'environnement** :
- `TEXTRAZOR_API_KEY` : Clé API TextRazor (obligatoire)
- `PORT` : Port du service (défini par Render, généralement 8080)
- `ALLOWED_ORIGINS` : Liste des origines CORS autorisées (optionnel)

### Testing

**Health checks** :
```bash
curl https://serpmantic-nlp.onrender.com/health
# → {"status":"ok"}

curl https://serpmantic-nlp.onrender.com/health/ready
# → {"status":"ready","timestamp":"2026-03-20T20:00:00.000000"}
```

**Usage monitoring** :
```bash
curl https://serpmantic-nlp.onrender.com/textrazor/usage
# → {
#     "requests_today": 125,
#     "daily_limit": 500,
#     "requests_remaining": 375,
#     "reset_at": "2026-03-21T00:00:00.000000+00:00",
#     "last_reset": "2026-03-20"
#   }
```

**NLP Analysis** :
```bash
curl -X POST https://serpmantic-nlp.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Les délégataires CEE sont des acteurs essentiels.",
      "Un délégataire CEE accompagne les particuliers."
    ],
    "language": "fr"
  }'
# → {"terms": [...], "terms_to_avoid": [...]}
```

### Known Limitations

1. **In-memory tracking** : Le compteur de requêtes TextRazor se réinitialise au redémarrage du service
   - Pour un tracking persistant, migrer vers Redis ou PostgreSQL
2. **Free tier TextRazor** : Limite de 500 requêtes/jour
   - Implémenter le cache SERP pour réduire l'utilisation de 70-80%
3. **Concurrent requests** : Limite de 2 requêtes concurrentes sur le plan gratuit
   - Le service peut bloquer si > 2 requêtes simultanées

### Rollback Plan

Si TextRazor pose problème, rollback vers l'ancien pipeline :

1. Éditer `main.py` :
```python
# Remplacer
from textrazor_pipeline import analyze_corpus
# Par
from pipeline import analyze_corpus
```

2. Redéployer sur Render
3. L'ancien pipeline basique (sans lemmatisation) reprend le relais

### Documentation

- [DEPLOY_TEXTRAZOR.md](../../DEPLOY_TEXTRAZOR.md) : Guide de déploiement complet
- [MIGRATION_TEXTRAZOR.md](MIGRATION_TEXTRAZOR.md) : Récapitulatif de migration
- [MONITORING_TEXTRAZOR.md](../../MONITORING_TEXTRAZOR.md) : Guide du widget de monitoring
- [README.md](README.md) : Documentation du service NLP

---

## [1.0.0] - 2026-03-01

### Initial Release

- ✅ Service NLP basique avec tokenisation simple
- ✅ Extraction TF-IDF des termes significatifs
- ✅ Support français uniquement
- ✅ Endpoint `/analyze` avec métriques structurelles
- ✅ Déploiement sur Render.com
