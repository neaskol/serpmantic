# 🚀 Déploiement TextRazor sur Render.com

Guide complet pour déployer le service NLP avec TextRazor sur Render.com.

---

## ✅ Prérequis

- [x] Compte TextRazor créé sur https://www.textrazor.com/
- [x] Clé API TextRazor : `983cfb36d574b5cc112c69a2574a900d1252c8882b32a39eae002ebe`
- [x] Compte Render.com
- [x] Code pushé sur le repository Git

---

## 📋 Étapes de déploiement

### 1. Accéder au service Render

1. Aller sur https://dashboard.render.com/
2. Chercher le service **serpmantic-nlp**
3. Cliquer dessus pour ouvrir la configuration

### 2. Configurer les variables d'environnement

1. Dans le menu de gauche, cliquer sur **Environment**
2. Cliquer sur **Add Environment Variable**
3. Ajouter la variable suivante:

```
Key:   TEXTRAZOR_API_KEY
Value: 983cfb36d574b5cc112c69a2574a900d1252c8882b32a39eae002ebe
```

4. Cliquer sur **Save Changes**

### 3. Vérifier la configuration du service

Dans l'onglet **Settings**, vérifier :

```
Name:          serpmantic-nlp
Environment:   Python 3
Region:        Frankfurt (EU Central)
Branch:        main
Root Directory: services/nlp
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 4. Déclencher le déploiement

**Option A - Automatique** (si auto-deploy activé):
- Le push Git déclenche automatiquement le déploiement

**Option B - Manuel**:
1. Dans le dashboard Render, cliquer sur **Manual Deploy**
2. Sélectionner **Deploy latest commit**
3. Confirmer

### 5. Surveiller le build

1. Cliquer sur l'onglet **Logs**
2. Vérifier que les dépendances s'installent :
   ```
   Installing fastapi>=0.115.0
   Installing textrazor>=1.4.1
   Installing python-dotenv>=1.0.0
   ...
   Successfully installed textrazor-1.4.1
   ```

3. Vérifier que le service démarre :
   ```
   INFO:     Started server process
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   INFO:     Uvicorn running on http://0.0.0.0:8080
   ```

### 6. Tester le service déployé

**Test 1 - Health check**:
```bash
curl https://serpmantic-nlp.onrender.com/health
# Réponse attendue: {"status":"ok"}
```

**Test 2 - Analyse NLP**:
```bash
curl -X POST https://serpmantic-nlp.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Les délégataires CEE sont des acteurs essentiels du dispositif.",
      "Un délégataire CEE accompagne les particuliers dans leurs projets."
    ],
    "language": "fr"
  }'
```

**Réponse attendue** (extrait):
```json
{
  "terms": [
    {
      "term": "délégatair",
      "display_term": "délégatair",
      "min_occurrences": 2,
      "max_occurrences": 2,
      "importance": 20.0,
      "term_type": "unigram"
    },
    ...
  ],
  "terms_to_avoid": []
}
```

---

## 🔍 Vérification de l'intégration

### Test depuis l'app Next.js

1. Vérifier que `apps/web/.env.local` contient :
   ```env
   NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com
   ```

2. Créer un nouveau guide dans l'app
3. Vérifier dans les logs Render que les requêtes arrivent :
   ```
   INFO     Analysis started language=fr num_texts=10
   INFO     Document 1/10: 45 lemmas extracted
   INFO     Document 2/10: 38 lemmas extracted
   ...
   INFO     Analysis complete: 87 significant terms, 3 terms to avoid
   ```

---

## 📊 Monitoring

### Vérifier le quota TextRazor

1. Aller sur https://www.textrazor.com/
2. Se connecter avec votre compte
3. Dashboard → **Usage**
4. Vérifier le nombre de requêtes utilisées/500 par jour

### Logs Render

```bash
# Via dashboard
Dashboard → Services → serpmantic-nlp → Logs

# Via CLI Render (optionnel)
render logs serpmantic-nlp
```

### Métriques importantes

- **Requests per day** : < 500 (limite free tier)
- **Response time** : ~500-1500ms par requête TextRazor
- **Error rate** : < 1%

---

## ⚠️ Troubleshooting

### Erreur: "TEXTRAZOR_API_KEY not found"

**Cause**: Variable d'environnement manquante

**Solution**:
1. Dashboard Render → Environment
2. Ajouter `TEXTRAZOR_API_KEY`
3. Redéployer

### Erreur: "SSL: CERTIFICATE_VERIFY_FAILED"

**Cause**: Certificats SSL non configurés

**Solution**: Déjà résolu dans `textrazor_pipeline.py` :
```python
os.environ['SSL_CERT_FILE'] = certifi.where()
```

Si le problème persiste, vérifier que `certifi` est bien installé.

### Erreur: "429 Too Many Requests"

**Cause**: Quota TextRazor dépassé (500 req/jour)

**Solutions**:
1. **Court terme**: Attendre le reset quotidien (minuit UTC)
2. **Moyen terme**: Implémenter le cache des analyses SERP
3. **Long terme**: Passer au plan payant TextRazor ($200/mois)

### Service en "Suspended" sur Render

**Cause**: Free tier Render (service inactif après 15 min)

**Solution**: Le service redémarre automatiquement à la première requête (cold start ~30s)

---

## 🎯 Optimisations recommandées

### 1. Cache des analyses SERP (Priority 1)

```typescript
// apps/web/src/lib/cache-serp.ts
const CACHE_TTL = 30 * 24 * 60 * 60; // 30 jours

async function getCachedSerpAnalysis(keyword: string, language: string) {
  // Vérifier si analyse existe en cache
  // Si oui, retourner
  // Sinon, appeler NLP service et mettre en cache
}
```

**Économie estimée**: 70-80% des requêtes TextRazor

### 2. Analyser seulement top 5 pages SERP

```typescript
// Au lieu de top 10
const serpPages = await fetchSerp(keyword, language);
const topPages = serpPages.slice(0, 5); // ← Réduire à 5
```

**Économie estimée**: 50% des requêtes TextRazor

### 3. Regrouper les petites pages

```python
# textrazor_pipeline.py
def batch_small_texts(texts: List[str], max_size=150_000):
    """Regroupe les textes < 50KB en batches."""
    batches = []
    current_batch = []
    current_size = 0

    for text in texts:
        size = len(text.encode('utf-8'))
        if size > 50_000:
            batches.append([text])  # Grande page seule
        elif current_size + size < max_size:
            current_batch.append(text)
            current_size += size
        else:
            batches.append(current_batch)
            current_batch = [text]
            current_size = size

    return batches
```

**Économie estimée**: 30-40% des requêtes TextRazor

---

## 📈 Passage au plan payant TextRazor

Si vous dépassez régulièrement 500 req/jour :

### Tarifs

| Plan | Requêtes/mois | Concurrent | Prix |
|------|---------------|------------|------|
| Free | ~15,000 (500/jour) | 2 | $0 |
| Starter | 6,000 | 5 | $200/mois |
| Pro | Illimité | 10+ | $1,200/mois |

### Calcul du break-even

- **50 guides/jour** = 500 requêtes (top 10 pages)
- **25 guides/jour** = 250 requêtes (top 10 pages)
- **50 guides/jour** = 250 requêtes (top 5 pages + cache)

**Recommandation** : Implémenter cache + top 5 pages AVANT de passer au payant.

---

## ✅ Checklist finale

- [ ] Variable `TEXTRAZOR_API_KEY` configurée sur Render
- [ ] Service déployé et en status "Live"
- [ ] Health check répond 200 OK
- [ ] Analyse NLP fonctionne (test curl)
- [ ] App Next.js peut appeler le service
- [ ] Logs montrent les analyses TextRazor
- [ ] Quota TextRazor surveillé

---

## 📞 Support

- **TextRazor**: support@textrazor.com
- **Render**: support@render.com
- **Dashboard TextRazor**: https://www.textrazor.com/
- **Dashboard Render**: https://dashboard.render.com/

---

**✨ Migration complétée avec succès !**
