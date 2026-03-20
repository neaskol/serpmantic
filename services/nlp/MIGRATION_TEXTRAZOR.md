# Migration vers TextRazor - Récapitulatif

**Date**: 20 mars 2026
**Status**: ✅ Complété et testé

## Changements effectués

### 1. Configuration
- ✅ Ajout de `TEXTRAZOR_API_KEY` dans `.env`
- ✅ Création de `.env.example` pour la documentation
- ✅ Ajout de `.gitignore` pour protéger les secrets

### 2. Dépendances
**Nouveau `requirements.txt`:**
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.9.0
httpx>=0.28.0
textrazor>=1.4.1        # ← NOUVEAU
python-dotenv>=1.0.0   # ← NOUVEAU
```

### 3. Nouveau pipeline NLP
**Fichier**: `textrazor_pipeline.py`

**Fonctionnalités**:
- Lemmatisation via TextRazor (ex: "délégataires" → "délégatair")
- Extraction d'entités nommées (organisations, lieux, etc.)
- Analyse de topics sémantiques
- POS tagging avancé (NOUN, VERB, ADJ, PROPN, ADV)
- Support multilingue (FR, EN, IT, DE, ES)

**Améliorations vs pipeline basique**:
| Fonctionnalité | Pipeline basique | TextRazor |
|----------------|------------------|-----------|
| Lemmatisation | ❌ Non | ✅ Oui |
| Entités | ❌ Non | ✅ Oui |
| Topics | ❌ Non | ✅ Oui |
| POS tagging | ❌ Basique | ✅ Avancé |
| Qualité | 📊 Moyenne | 📊 Professionnelle |

### 4. Configuration SSL
**Fix pour macOS**:
```python
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
```

### 5. Tests
**Fichiers de test créés**:
- `test_textrazor.py` - Test d'intégration complet
- `debug_textrazor.py` - Debug de la structure Word de TextRazor

**Résultats de test**:
```
✅ Analysis completed successfully!
📊 Results:
  - 24 significant terms found
  - 0 terms to avoid

🔝 Top Terms:
délégatair (importance: 36.7)
énerg (importance: 23.3)
économ (importance: 16.7)
```

## Déploiement sur Render.com

### Variables d'environnement à configurer

1. Aller sur [Render Dashboard](https://dashboard.render.com/)
2. Sélectionner le service `serpmantic-nlp`
3. Environment → Add Environment Variable:
   ```
   TEXTRAZOR_API_KEY=983cfb36d574b5cc112c69a2574a900d1252c8882b32a39eae002ebe
   ```

### Redéploiement

Le service se redéploiera automatiquement après le push Git.

**Commandes de vérification**:
```bash
# Health check
curl https://serpmantic-nlp.onrender.com/health

# Test d'analyse
curl -X POST https://serpmantic-nlp.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Test de lemmatisation français"],
    "language": "fr"
  }'
```

## Limites TextRazor

### Free Tier
- **500 requêtes/jour** (suffisant pour ~50 guides/jour)
- **2 requêtes concurrentes max**
- **200 KB max par requête**

### Tarification si dépassement
- **Starter**: $200/mois (6,000 req/mois)
- **Pro**: $1,200/mois (usage illimité)

### Optimisations possibles
1. **Cache des analyses SERP** (30 jours)
2. **Analyser seulement top 5 pages** au lieu de 10
3. **Regrouper les petites pages** en une seule requête

## Rollback plan

Si TextRazor pose problème, rollback facile :

1. Éditer `main.py`:
   ```python
   # Remplacer
   from textrazor_pipeline import analyze_corpus
   # Par
   from pipeline import analyze_corpus
   ```

2. Redéployer

L'ancien pipeline reste disponible dans `pipeline.py`.

## Prochaines étapes

- [ ] Monitorer les logs Render après déploiement
- [ ] Vérifier la consommation du quota TextRazor
- [ ] Implémenter le cache des analyses SERP
- [ ] Tester avec des guides réels en production

## Contacts

- **TextRazor Support**: support@textrazor.com
- **Dashboard**: https://www.textrazor.com/
- **Documentation**: https://www.textrazor.com/docs/python
