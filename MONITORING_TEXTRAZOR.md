# 📊 Monitoring TextRazor API Usage

Guide d'utilisation du widget de monitoring du quota TextRazor intégré au dashboard.

---

## ✅ Fonctionnalité

Le widget **TextRazor Usage** affiche en temps réel l'utilisation de votre quota d'API TextRazor directement sur le dashboard principal de l'application.

### Informations affichées

- **Requêtes utilisées aujourd'hui** : nombre de requêtes consommées depuis minuit UTC
- **Limite quotidienne** : 500 requêtes/jour (plan gratuit)
- **Requêtes restantes** : quota disponible pour le reste de la journée
- **Barre de progression** : visualisation colorée du pourcentage d'utilisation
  - 🟢 Vert : < 50% (utilisation normale)
  - 🟡 Jaune : 50-80% (utilisation modérée)
  - 🔴 Rouge : > 80% (attention - quota bientôt atteint)
- **Heure de réinitialisation** : prochain reset du compteur (minuit UTC)
- **Conseil d'optimisation** : affiché automatiquement si utilisation > 90%

---

## 🎯 Utilisation

### Accès au widget

1. Se connecter à l'application
2. Accéder au **Dashboard** principal (`/dashboard`)
3. Le widget s'affiche automatiquement en haut de la page, au-dessus de la liste des guides

### Rafraîchissement automatique

- Les données se mettent à jour **automatiquement toutes les 30 secondes**
- Aucune action manuelle requise

---

## 🔧 Architecture technique

### Frontend

**Composant** : `apps/web/src/components/dashboard/textrazor-usage.tsx`
- État local React avec `useState`
- Polling automatique toutes les 30s avec `useEffect`
- Appel à l'API Next.js `/api/textrazor/usage`
- Composants UI : `Card`, `Progress`, `ProgressIndicator`, `Skeleton`

**Endpoint API** : `apps/web/src/app/api/textrazor/usage/route.ts`
- Proxy vers le service NLP Python
- Retourne des données mockées si le service est indisponible
- Format de réponse :
```json
{
  "daily_limit": 500,
  "requests_today": 125,
  "requests_remaining": 375,
  "reset_at": "2026-03-21T00:00:00.000Z",
  "percentage_used": 25.0
}
```

### Backend (NLP Service)

**Endpoint** : `GET /textrazor/usage` dans `services/nlp/main.py`
- Tracking in-memory des requêtes (réinitialisation au redémarrage du service)
- Reset automatique du compteur à minuit UTC chaque jour
- Incrémentation du compteur à chaque appel `/analyze`

**Variables trackées** :
```python
usage_tracker = {
    "requests_today": 0,
    "last_reset": "2026-03-20"  # Date ISO format
}
```

---

## ⚠️ Limites actuelles

### 1. Tracking in-memory (non persistant)

Le compteur de requêtes est stocké **en mémoire** dans le service NLP Python.

**Conséquences** :
- ✅ Simple et rapide
- ❌ Le compteur se **réinitialise à 0** si le service redémarre (ex: déploiement sur Render)
- ❌ Peut sous-estimer l'utilisation réelle si le service redémarre plusieurs fois dans la journée

**Solutions pour production** :
1. **Redis** : stocker `usage_tracker` dans Redis avec expiration automatique à minuit UTC
2. **Base de données** : table `textrazor_usage` avec colonnes `date` et `requests_count`
3. **API TextRazor officielle** : appeler l'API de statistiques de TextRazor (si disponible)

### 2. Tracking basé sur le serveur NLP

Le compteur suit uniquement les requêtes passant par **notre service NLP**.

**Cas non comptabilisés** :
- Requêtes directes à l'API TextRazor depuis d'autres services (si applicable)
- Requêtes provenant d'autres environnements (dev, staging) utilisant la même clé API

**Solution** :
- Utiliser une clé API TextRazor **différente par environnement**
- Centraliser le tracking dans une base de données partagée

---

## 📈 Optimisations recommandées

### 1. Implémenter le cache SERP (Priority 1)

**Problème** : Chaque création de guide appelle TextRazor pour analyser les ~10 pages SERP.

**Solution** : Mettre en cache les résultats d'analyse SERP pendant 30 jours.

```typescript
// apps/web/src/lib/cache-serp.ts
const CACHE_TTL = 30 * 24 * 60 * 60 // 30 jours

async function getCachedSerpAnalysis(keyword: string, language: string) {
  // 1. Vérifier si analyse existe en cache (Supabase ou Redis)
  // 2. Si cache valide, retourner les résultats
  // 3. Sinon, appeler NLP service et mettre en cache
}
```

**Économie estimée** : 70-80% des requêtes TextRazor

### 2. Analyser seulement top 5 pages SERP

**Problème** : Analyser 10 pages SERP = 10 requêtes TextRazor par guide créé.

**Solution** : Réduire à 5 pages les plus pertinentes.

```typescript
// Avant :
const serpPages = await fetchSerp(keyword, language) // 10 pages
const analysis = await analyzePages(serpPages) // 10 requêtes

// Après :
const serpPages = await fetchSerp(keyword, language)
const topPages = serpPages.slice(0, 5) // 5 pages seulement
const analysis = await analyzePages(topPages) // 5 requêtes
```

**Économie estimée** : 50% des requêtes TextRazor

### 3. Regrouper les petites pages en batches

**Problème** : Chaque page SERP = 1 requête TextRazor, même pour des pages courtes.

**Solution** : Regrouper plusieurs petites pages (< 50 KB) en une seule requête.

```python
# textrazor_pipeline.py
def batch_small_texts(texts: List[str], max_size=150_000):
    """Regroupe les textes < 50KB en batches de 150KB max."""
    batches = []
    current_batch = []
    current_size = 0

    for text in texts:
        size = len(text.encode('utf-8'))
        if size > 50_000:
            batches.append([text])  # Grande page = batch seule
        elif current_size + size < max_size:
            current_batch.append(text)
            current_size += size
        else:
            batches.append(current_batch)
            current_batch = [text]
            current_size = size

    if current_batch:
        batches.append(current_batch)

    return batches
```

**Économie estimée** : 30-40% des requêtes TextRazor

---

## 🚀 Migration vers plan payant TextRazor

Si vous dépassez régulièrement 500 requêtes/jour :

### Tarifs TextRazor

| Plan | Requêtes/mois | Concurrent | Prix |
|------|---------------|------------|---------|
| Free | ~15,000 (500/jour) | 2 | $0 |
| Starter | 6,000 | 5 | $200/mois |
| Pro | Illimité | 10+ | $1,200/mois |

### Calcul du break-even

- **50 guides/jour** × 10 pages SERP = **500 requêtes** → Plan gratuit suffisant
- **100 guides/jour** × 10 pages SERP = **1,000 requêtes** → Plan payant nécessaire
- **50 guides/jour** × 5 pages SERP + cache = **~100 requêtes** → Plan gratuit largement suffisant

**Recommandation** : Implémenter **cache + top 5 pages** AVANT de passer au plan payant.

---

## 🔍 Monitoring avancé (roadmap)

### Fonctionnalités à ajouter

1. **Historique d'utilisation**
   - Graphique des 30 derniers jours
   - Détection des pics d'utilisation

2. **Alertes automatiques**
   - Email/notification si quota > 90%
   - Webhook pour intégration Slack/Discord

3. **Statistiques par utilisateur**
   - Qui consomme le plus de quota ?
   - Requêtes par guide créé

4. **Prédiction de dépassement**
   - "À ce rythme, vous atteindrez 500 requêtes à 18h00"

5. **Comparaison multi-jours**
   - "Aujourd'hui : 300 requêtes | Hier : 250 requêtes (+20%)"

---

## 📞 Support

- **Dashboard TextRazor** : https://www.textrazor.com/
- **Documentation API** : https://www.textrazor.com/docs/python
- **Email support** : support@textrazor.com

---

**✨ Widget de monitoring déployé avec succès !**

Le dashboard affiche maintenant en temps réel l'utilisation du quota TextRazor pour éviter les dépassements et optimiser l'utilisation de l'API.
