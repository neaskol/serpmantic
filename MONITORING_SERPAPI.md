# 📊 Monitoring SerpAPI Usage

Guide d'utilisation du widget de monitoring du quota SerpAPI intégré au dashboard.

---

## ✅ Fonctionnalité

Le widget **SerpAPI Usage** affiche en temps réel l'utilisation de votre quota d'API SerpAPI directement sur le dashboard principal de l'application, côte à côte avec le widget TextRazor.

### Informations affichées

- **Requêtes utilisées aujourd'hui** : nombre de requêtes consommées depuis minuit UTC
- **Moyenne quotidienne recommandée** : ~3 requêtes/jour (pour rester sous la limite mensuelle de 100)
- **Limite mensuelle** : 100 requêtes/mois (plan gratuit)
- **Requêtes restantes aujourd'hui** : quota disponible pour rester dans la moyenne
- **Barre de progression** : visualisation colorée du pourcentage d'utilisation quotidienne
  - 🔵 Bleu : < 50% (utilisation faible)
  - 🟡 Jaune : 50-80% (utilisation normale)
  - 🔴 Rouge : > 80% (attention - quota quotidien dépassé)
- **Estimation mensuelle** : projection du nombre de requêtes pour le mois entier
- **Heure de réinitialisation** : prochain reset du compteur quotidien (minuit UTC)
- **Alertes automatiques** :
  - Avertissement si estimation mensuelle > 80 requêtes
  - Alerte critique si quota quotidien dépassé (> 3 requêtes/jour)

---

## 🎯 Utilisation

### Accès au widget

1. Se connecter à l'application
2. Accéder au **Dashboard** principal (`/dashboard`)
3. Le widget s'affiche automatiquement en haut de la page, **à côté du widget TextRazor**

### Disposition des widgets

```
┌────────────────────────────────────────────────────────┐
│                      Dashboard                         │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │  Quota TextRazor API │  │  Quota SerpAPI       │  │
│  │  500 req/jour        │  │  100 req/mois        │  │
│  └──────────────────────┘  └──────────────────────┘  │
├────────────────────────────────────────────────────────┤
│                  Liste des guides                      │
└────────────────────────────────────────────────────────┘
```

### Rafraîchissement automatique

- Les données se mettent à jour **automatiquement toutes les 30 secondes**
- Synchronisé avec le widget TextRazor

---

## 🔧 Architecture technique

### Frontend

**Composant** : `apps/web/src/components/dashboard/serpapi-usage.tsx`
- État local React avec `useState`
- Polling automatique toutes les 30s avec `useEffect`
- Appel à l'API Next.js `/api/serpapi/usage`
- Composants UI : `Card`, `Progress`, `ProgressIndicator`, `Skeleton`

**Endpoint API** : `apps/web/src/app/api/serpapi/usage/route.ts`
- Appelle directement `getSerpApiUsage()` depuis `serpapi-tracker`
- Pas de dépendance externe (tracking local in-memory)
- Format de réponse :
```json
{
  "requests_today": 5,
  "daily_average": 3,
  "monthly_limit": 100,
  "requests_remaining_today": 0,
  "reset_at": "2026-03-21T00:00:00.000Z",
  "percentage_used": 166.67,
  "last_reset": "2026-03-20"
}
```

### Backend (Tracker Module)

**Module** : `apps/web/src/lib/serpapi-tracker.ts`
- Tracking in-memory des requêtes avec reset automatique à minuit UTC
- Incrémentation du compteur à chaque appel `fetchSerpResults()` dans `serp.ts`
- Calcul automatique de la moyenne quotidienne recommandée (100 / 30 ≈ 3 req/jour)
- Estimation mensuelle basée sur l'utilisation actuelle

**Variables trackées** :
```typescript
interface UsageTracker {
  requests_today: number
  last_reset: string // ISO date (YYYY-MM-DD)
}
```

**Fonctions exposées** :
- `trackSerpApiRequest()` : Incrémente le compteur (appelée depuis `serp.ts`)
- `getSerpApiUsage()` : Retourne les statistiques actuelles
- `resetSerpApiUsage()` : Reset manuel (pour les tests)

### Intégration dans `serp.ts`

**Fichier modifié** : `apps/web/src/lib/serp.ts`

```typescript
import { trackSerpApiRequest } from './serpapi-tracker'

export async function fetchSerpResults(...) {
  // ... code existant ...

  const data = await getJson('google', params)

  // Track SerpAPI usage ← NOUVEAU
  trackSerpApiRequest()

  // ... reste du code ...
}
```

---

## ⚠️ Limites actuelles

### 1. Tracking in-memory (non persistant)

**Problème** : Le compteur de requêtes est stocké **en mémoire** dans le serveur Next.js.

**Conséquences** :
- ✅ Simple et rapide (pas de dépendance externe)
- ❌ Le compteur se **réinitialise à 0** si le serveur Next.js redémarre (ex: déploiement Vercel)
- ❌ Peut sous-estimer l'utilisation réelle si le serveur redémarre plusieurs fois dans la journée

**Solutions pour production** :
1. **Redis** : Stocker `usage_tracker` dans Redis avec expiration automatique à minuit UTC
2. **Supabase** : Table `serpapi_usage(date, requests_count)` avec trigger de cleanup quotidien
3. **Vercel KV** : Stocker le compteur dans Vercel KV (Redis managé)

### 2. Limite mensuelle vs quotidienne

**Problème** : SerpAPI facture par **mois** (100 req/mois), mais le tracking est **quotidien**.

**Conséquences** :
- Le widget affiche une "moyenne quotidienne recommandée" (~3 req/jour)
- Si vous utilisez 20 requêtes le jour 1, vous êtes techniquement "en avance" mais pas bloqué
- L'estimation mensuelle aide à prédire si vous dépasserez 100 req/mois

**Solution actuelle** :
- Widget affiche clairement : "~3 requêtes/jour" (moyenne recommandée)
- Estimation mensuelle : `requests_today × 30`
- Alerte si estimation > 80% de 100 (soit > 80 requêtes/mois projetées)

### 3. Pas de quota "dur"

**Différence avec TextRazor** :
- TextRazor : limite **stricte** de 500 req/jour (API rejette après dépassement)
- SerpAPI : limite **souple** de 100 req/mois (peut techniquement dépasser, mais facturation ou suspension possible)

**Impact** :
- Le widget SerpAPI est **prédictif** (avertit avant dépassement)
- Le widget TextRazor est **réactif** (affiche le quota restant réel)

---

## 📊 Exemple visuel du widget

### Utilisation normale (2 requêtes/jour)

```
┌────────────────────────────────────────────────┐
│ Quota SerpAPI             Plan gratuit        │
├────────────────────────────────────────────────┤
│ Requêtes aujourd'hui                 2 / ~3    │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░ 67%      │
│ Utilisation normale                            │
├────────────────────────────────────────────────┤
│ Limite mensuelle           100 requêtes/mois   │
│ Estimation mois en cours              ~60 / 100│
│ Réinitialisation : 00:00                       │
└────────────────────────────────────────────────┘
```

### Dépassement quotidien (5 requêtes/jour)

```
┌────────────────────────────────────────────────┐
│ Quota SerpAPI             Plan gratuit        │
├────────────────────────────────────────────────┤
│ Requêtes aujourd'hui                 5 / ~3    │
│ ████████████████████████████████████ 167%     │
│ ⚠️ Quota quotidien dépassé                     │
├────────────────────────────────────────────────┤
│ Limite mensuelle           100 requêtes/mois   │
│ Estimation mois en cours             ~150 / 100│
│ Réinitialisation : 00:00                       │
├────────────────────────────────────────────────┤
│ ⚠️ Quota quotidien dépassé : Limitez la       │
│    création de nouveaux guides ou implémentez │
│    le cache SERP pour éviter les requêtes     │
│    inutiles.                                   │
└────────────────────────────────────────────────┘
```

### Risque de dépassement mensuel

```
┌────────────────────────────────────────────────┐
│ Quota SerpAPI             Plan gratuit        │
├────────────────────────────────────────────────┤
│ Requêtes aujourd'hui                 3 / ~3    │
│ ████████████████████░░░░░░░░░░░░░░░░ 100%     │
│ Attention - Quota quotidien bientôt atteint    │
├────────────────────────────────────────────────┤
│ Limite mensuelle           100 requêtes/mois   │
│ Estimation mois en cours              ~90 / 100│
│ Réinitialisation : 00:00                       │
├────────────────────────────────────────────────┤
│ ⚠️ Attention : Vous risquez de dépasser la    │
│    limite mensuelle de 100 requêtes.          │
│    Implémentez le cache SERP pour réduire     │
│    les appels API.                             │
└────────────────────────────────────────────────┘
```

---

## 📈 Optimisations recommandées

### 1. Implémenter le cache SERP (Priority 1)

**Économie estimée** : 90-95% des requêtes SerpAPI

**Problème** : Chaque création de guide appelle SerpAPI pour récupérer les 10 résultats de la SERP.

**Solution** : Mettre en cache les résultats SERP pendant **30-60 jours**.

```typescript
// apps/web/src/lib/cache-serp.ts
const CACHE_TTL = 60 * 24 * 60 * 60 // 60 jours

async function getCachedSerpResults(keyword: string, language: string, searchEngine: string) {
  // 1. Générer une clé de cache
  const cacheKey = `serp:${searchEngine}:${language}:${keyword.toLowerCase()}`

  // 2. Vérifier si résultats existent en cache (Redis ou Supabase)
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // 3. Sinon, appeler SerpAPI et mettre en cache
  const results = await fetchSerpResults(keyword, language, searchEngine)
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results))

  return results
}
```

**Impact** :
- Même mot-clé analysé plusieurs fois = **1 seule requête SerpAPI**
- Réduction drastique : de 100 req/mois à **5-10 req/mois**

### 2. Analyser seulement top 5 pages SERP

**Économie estimée** : Aucune (ne réduit pas les appels SerpAPI)

**Note** : SerpAPI facture par **recherche**, pas par nombre de résultats.
- 10 résultats = 1 requête SerpAPI
- 5 résultats = 1 requête SerpAPI (même coût)

**Conclusion** : Cette optimisation ne s'applique **pas** à SerpAPI (uniquement à TextRazor qui facture par page analysée).

### 3. Limiter la création de guides

**Économie estimée** : Variable selon l'usage

**Solution** : Afficher un message si quota quotidien dépassé :
```typescript
if (serpApiUsage.percentage_used > 100) {
  return <Alert>
    Quota quotidien SerpAPI dépassé. Créez des guides demain ou implémentez le cache SERP.
  </Alert>
}
```

---

## 🚀 Migration vers plan payant SerpAPI

Si le plan gratuit est insuffisant :

### Tarifs SerpAPI

| Plan | Recherches/mois | Prix | Note |
|------|-----------------|------|------|
| Free | 100 | $0 | Limite stricte |
| Developer | 5,000 | $50/mois | $0.01/recherche supplémentaire |
| Production | 15,000 | $100/mois | Volume pricing |

### Calcul du break-even

**Sans cache SERP** :
- 1 guide créé = 1 recherche SerpAPI
- 100 guides/mois = **100 recherches** → Plan gratuit OK
- 150 guides/mois = **150 recherches** → Plan payant nécessaire ($50/mois)

**Avec cache SERP** :
- 100 guides/mois avec 90% de cache hit = **10 recherches** → Plan gratuit largement suffisant
- 1,000 guides/mois avec 90% de cache hit = **100 recherches** → Plan gratuit OK !

**Recommandation** : Implémenter le **cache SERP** AVANT de passer au plan payant. Cela devrait suffire pour la plupart des cas d'usage.

---

## 🔍 Monitoring avancé (roadmap)

### Fonctionnalités à ajouter

1. **Historique mensuel complet**
   - Graphique des 30 derniers jours
   - Comparaison mois en cours vs mois précédent

2. **Alertes automatiques**
   - Email/notification si quota quotidien dépassé
   - Webhook si estimation mensuelle > 100

3. **Cache hit rate**
   - Afficher le pourcentage de requêtes servies depuis le cache
   - "95% des requêtes SERP servies depuis le cache"

4. **Statistiques par mot-clé**
   - Quels mots-clés sont les plus recherchés ?
   - Identifier les opportunités de cache prématuré

5. **Prédiction de dépassement**
   - "À ce rythme, vous atteindrez 100 requêtes le 25 mars"
   - Suggestion de ralentir ou d'implémenter le cache

---

## 🆚 Comparaison TextRazor vs SerpAPI

| Critère | TextRazor | SerpAPI |
|---------|-----------|---------|
| **Limite free tier** | 500 req/jour | 100 req/mois |
| **Type de quota** | Quotidien (strict) | Mensuel (souple) |
| **Reset** | Minuit UTC (quotidien) | Fin du mois |
| **Facturation** | Par document analysé | Par recherche effectuée |
| **Impact cache SERP** | 70-80% économie | 90-95% économie |
| **Dépassement** | API rejette immédiatement | Facturation ou suspension possible |
| **Widget** | Affiche quota restant réel | Affiche estimation/moyenne |

---

## 📞 Support

- **Dashboard SerpAPI** : https://serpapi.com/dashboard
- **Documentation API** : https://serpapi.com/docs
- **Tarifs** : https://serpapi.com/pricing
- **Email support** : support@serpapi.com

---

**✨ Widget de monitoring SerpAPI déployé avec succès !**

Le dashboard affiche maintenant côte à côte les quotas **TextRazor** et **SerpAPI** pour un suivi complet de l'utilisation des APIs tierces.

**Prochaine étape critique** : Implémenter le **cache SERP** pour réduire drastiquement les appels SerpAPI (de 100 req/mois à ~5-10 req/mois).
