# Guide de configuration Upstash Redis

## 🎯 Pourquoi Upstash ?

Upstash est utilisé dans SERPmantics pour :
- **Rate limiting** : limiter les requêtes par utilisateur/IP
- **Cache SERP** : éviter de re-scraper les mêmes requêtes
- **Cache NLP** : stocker les analyses sémantiques
- **Sessions** : gérer les sessions utilisateur

**Tier gratuit** : 10,000 requêtes/jour (largement suffisant pour MVP)

---

## 📝 Étape 1 : Créer un compte Upstash

1. Aller sur [console.upstash.com](https://console.upstash.com/login)

2. Choisir votre méthode de connexion :
   - **GitHub** (recommandé)
   - **Google**
   - **Email**

3. **Aucune carte bancaire requise** ✅

---

## 🗄️ Étape 2 : Créer une base Redis

### Via l'interface web

1. Une fois connecté, cliquer sur **"Create Database"**

2. Configuration recommandée :
   ```
   Name:           serpmantic-cache
   Type:           Regional (gratuit)
   Region:         Europe (Paris) - eu-west-1
                   ou US East (N. Virginia) - us-east-1

   Eviction:       LRU (Least Recently Used)
   TLS:            Enabled (par défaut)
   ```

3. Cliquer sur **"Create"**

---

## 🔑 Étape 3 : Récupérer les credentials

Une fois la base créée, vous verrez ces informations :

### Dans l'onglet "Details" :

```bash
# REST API (recommandé pour Vercel)
UPSTASH_REDIS_REST_URL=https://us1-xxx-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==

# Redis CLI (optionnel)
redis-cli -u redis://default:xxxxx@us1-xxx.upstash.io:6379
```

### Copiez ces 2 valeurs :
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## ⚙️ Étape 4 : Configurer dans Vercel

### Via l'interface Vercel

1. Aller sur [vercel.com/dashboard](https://vercel.com/dashboard)

2. Sélectionner votre projet **serpmantic**

3. Settings > Environment Variables

4. Ajouter ces 2 variables :

   ```bash
   UPSTASH_REDIS_URL = https://us1-xxx-xxxxx.upstash.io
   UPSTASH_REDIS_TOKEN = AxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==
   ```

5. **Important** : Sélectionner tous les environnements
   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. Cliquer sur **"Save"**

### Via .env.local (pour dev local)

Créer le fichier `apps/web/.env.local` :

```bash
# Upstash Redis
UPSTASH_REDIS_URL=https://us1-xxx-xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxQ==
```

⚠️ Ne jamais commit ce fichier (déjà dans `.gitignore`)

---

## ✅ Étape 5 : Tester la connexion

### Test en local

```bash
cd apps/web
pnpm dev
```

Puis ouvrir : http://localhost:3000/api/health

Vous devriez voir :

```json
{
  "status": "ok",
  "services": {
    "redis": "connected",
    "database": "connected"
  }
}
```

### Test sur Vercel

Une fois déployé : https://votre-app.vercel.app/api/health

---

## 🔧 Configuration avancée (optionnel)

### Upstash Dashboard Features

Dans l'interface Upstash, vous pouvez :

1. **Data Browser** : voir toutes les clés Redis en temps réel
   ```
   serpmantic:serp:mot-cle-123
   serpmantic:nlp:guide-abc-456
   serpmantic:ratelimit:user-789
   ```

2. **Metrics** : graphiques d'utilisation
   - Requêtes/jour
   - Latence moyenne
   - Taille du cache

3. **CLI Access** : tester les commandes Redis
   ```bash
   redis-cli -u redis://default:xxxxx@us1-xxx.upstash.io:6379
   > PING
   PONG
   > SET test "hello"
   OK
   > GET test
   "hello"
   ```

---

## 📊 Configuration du cache dans SERPmantics

Notre app utilise Upstash pour 3 types de cache :

### 1. Cache SERP (1 heure)

```typescript
// apps/web/src/lib/cache.ts
const cacheKey = `serpmantic:serp:${keyword}:${country}:${language}`;
await redis.set(cacheKey, serpData, { ex: 3600 }); // 1h
```

**Bénéfice** : Si 2 utilisateurs cherchent le même mot-clé, on ne scrape qu'une fois.

### 2. Cache NLP (24 heures)

```typescript
const cacheKey = `serpmantic:nlp:${guideId}`;
await redis.set(cacheKey, analysisData, { ex: 86400 }); // 24h
```

**Bénéfice** : Les analyses NLP ne sont recalculées qu'une fois par jour.

### 3. Rate Limiting (1 minute)

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'), // 10 req/min
});

const { success } = await ratelimit.limit(userId);
if (!success) throw new Error('Too many requests');
```

**Bénéfice** : Protection contre les abus API.

---

## 📈 Monitoring

### Dashboard Upstash

Dans l'interface Upstash, surveillez :
- **Daily Requests** : doit rester < 10k/jour (tier gratuit)
- **Storage** : doit rester < 256 MB (tier gratuit)
- **Latency** : doit être < 100ms

### Alertes automatiques

Upstash vous envoie un email si :
- Vous approchez la limite gratuite (8k/10k requêtes)
- Un spike de latence est détecté
- La base est pleine

---

## 🚨 Troubleshooting

### Erreur : "Connection refused"

**Cause** : Variables d'environnement mal configurées

**Solution** :
```bash
# Vérifier que les variables existent
echo $UPSTASH_REDIS_URL
echo $UPSTASH_REDIS_TOKEN

# Vérifier dans Vercel Settings > Environment Variables
# Redéployer après modification
```

### Erreur : "Rate limit exceeded"

**Cause** : > 10k requêtes/jour sur tier gratuit

**Solutions** :
1. **Court terme** : attendre 24h (reset quotidien)
2. **Optimiser le cache** : augmenter les TTL
3. **Upgrade** : passer au plan Pro ($10/mois = 100k req/jour)

### Latence élevée (> 200ms)

**Cause** : Région Upstash éloignée de Vercel

**Solution** :
1. Créer une nouvelle base Upstash dans la région la plus proche de votre Vercel region
2. Vercel utilise par défaut : `us-east-1` (Washington) ou `fra1` (Frankfurt)
3. Choisir Upstash : `us-east-1` ou `eu-west-1` (Paris)

---

## 💡 Bonnes pratiques

### 1. Nommage des clés

Utiliser un pattern cohérent :
```typescript
// ✅ Bon
const key = `serpmantic:${resource}:${id}:${variant}`;

// ❌ Mauvais
const key = `my-key-${Math.random()}`;
```

### 2. TTL adapté au contenu

```typescript
// SERP data (change peu souvent)
{ ex: 3600 }  // 1 heure

// NLP analysis (change rarement)
{ ex: 86400 } // 24 heures

// User session (temporaire)
{ ex: 1800 }  // 30 minutes

// Rate limit (court)
{ ex: 60 }    // 1 minute
```

### 3. Gestion d'erreur gracieuse

```typescript
try {
  const cached = await redis.get(key);
  if (cached) return cached;
} catch (error) {
  // Fallback : continuer sans cache
  console.warn('Redis error, falling back:', error);
}

// Continuer l'exécution même si Redis est down
const freshData = await fetchData();
```

---

## 🎓 Limites du tier gratuit

| Métrique | Limite gratuite | Suffisant pour |
|----------|----------------|----------------|
| Requêtes | 10k/jour | ~400 utilisateurs/jour |
| Stockage | 256 MB | ~100k clés simples |
| Bande passante | 200 MB/jour | ~50k requêtes API |
| Connexions | 1000 simultanées | Largement suffisant |

**Verdict** : Parfait pour MVP et démo

---

## 💰 Migration vers payant (si besoin)

Quand dépasser 10k requêtes/jour :

| Plan | Prix | Requêtes | Stockage |
|------|------|----------|----------|
| **Free** | $0 | 10k/jour | 256 MB |
| **Pay as you go** | $0.2/100k | Illimité | $0.25/GB |
| **Pro 2K** | $10/mois | 100k/jour | 1 GB inclus |
| **Pro 10K** | $40/mois | 500k/jour | 5 GB inclus |

**Conseil** : Commencer gratuit, passer au pay-as-you-go quand nécessaire.

---

## 📚 Ressources utiles

- [Documentation Upstash](https://docs.upstash.com/)
- [Upstash + Vercel Integration](https://vercel.com/integrations/upstash)
- [Upstash Redis SDK](https://github.com/upstash/upstash-redis)
- [@upstash/ratelimit](https://github.com/upstash/ratelimit)

---

## ✅ Checklist de configuration

- [ ] Compte Upstash créé
- [ ] Base Redis créée (région optimale)
- [ ] `UPSTASH_REDIS_URL` copié
- [ ] `UPSTASH_REDIS_TOKEN` copié
- [ ] Variables ajoutées dans Vercel
- [ ] Variables ajoutées dans `.env.local`
- [ ] Test `/api/health` réussi en local
- [ ] Test `/api/health` réussi sur Vercel
- [ ] Dashboard Upstash vérifié (Data Browser)

---

**Vous êtes prêt !** 🎉

Si vous avez des questions, consultez le [Dashboard Upstash](https://console.upstash.com) ou demandez de l'aide.
