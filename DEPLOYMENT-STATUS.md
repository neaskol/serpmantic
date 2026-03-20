# État du déploiement SERPmantics

**Date** : 20 mars 2026, 15:10
**Version** : v0.3.0

---

## ✅ Services configurés (3/5)

| Service | Statut | Détails |
|---------|--------|---------|
| **Upstash Redis** | ✅ Configuré | Cache + rate limiting OK |
| **OpenAI GPT** | ✅ Configuré | API key valide, gpt-4o-mini testé |
| **Groq (gratuit)** | ✅ Configuré | llama-3.3-70b-versatile OK |

---

## ⚠️ Services à corriger (2/5)

### 1. Supabase Database (Base de données)

**Problème** : Erreur 401 (Unauthorized)

**Causes possibles** :
- Base de données en pause (Supabase free tier)
- Clés API invalides ou expirées
- Projet supprimé

**Solution** :

1. Aller sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Vérifier votre projet : `sycxauunnhshuhehsafl`
3. Si statut = **"Paused"** :
   - Cliquer sur **"Resume"**
   - Attendre 30 secondes
4. Si statut = **"Active"** :
   - Aller dans Settings > API
   - Copier les nouvelles clés :
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Remplacer dans `apps/web/.env.local`

**Test après correction** :
```bash
node scripts/test-all-apis.js
```

---

### 2. Anthropic Claude (LLM)

**Problème** : Nom de modèle incorrect

**Cause** : Le modèle `claude-3-5-sonnet-20241022` n'existe pas ou API key invalide

**Solution** :

1. Vérifier votre clé API sur [console.anthropic.com](https://console.anthropic.com)
2. Vérifier votre solde (crédit API disponible)
3. Utiliser un des modèles valides :
   - `claude-3-5-sonnet-20241022` (meilleur, $3/$15 par million tokens)
   - `claude-3-5-haiku-20241022` (rapide, $0.25/$1.25 par million tokens)
   - `claude-3-opus-20240229` (puissant, $15/$75 par million tokens)

**Alternative gratuite** :

Utilisez **Groq** à la place (déjà configuré et fonctionnel) :
- Gratuit : 14,400 requêtes/jour
- Modèle : `llama-3.3-70b-versatile`
- Qualité équivalente à Claude pour la plupart des tâches

Pour utiliser Groq au lieu de Claude, modifier dans le code :
```typescript
// Avant
import { anthropic } from '@ai-sdk/anthropic';

// Après
import groqLLM from '@/lib/llm-groq';
const result = await groqLLM.generateContentPlan(keyword, serpData);
```

---

## 📋 Checklist de déploiement

### Étape 1 : Configuration locale ✅

- [x] `.env.local` créé
- [x] Upstash Redis configuré
- [x] OpenAI API key ajoutée
- [x] Groq API key ajoutée
- [ ] Supabase actif (à vérifier)
- [ ] Anthropic testé (optionnel)

### Étape 2 : Ajouter les variables dans Vercel

1. Aller sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionner le projet **serpmantic**
3. Settings > Environment Variables
4. Ajouter toutes les variables de `.env.local` :

```bash
# Supabase (après correction)
NEXT_PUBLIC_SUPABASE_URL=https://sycxauunnhshuhehsafl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Upstash Redis ✅
UPSTASH_REDIS_REST_URL=https://famous-gibbon-78583.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAATL3...

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-api03-...     # Optionnel
OPENAI_API_KEY=sk-proj-9Luw1_8w7...    # ✅ OK
GROQ_API_KEY=gsk_VxXMSDorsgQ7lh0...    # ✅ OK (gratuit)

# SERP (optionnel pour MVP)
SERPAPI_KEY=your-serpapi-key            # Ou utiliser custom scraper

# NLP Service (à déployer séparément)
NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com
```

**Important** : Cocher tous les environnements (Production, Preview, Development)

### Étape 3 : Déployer sur Vercel

**Option 1 : Via l'interface web** (recommandé)

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer le repo : `neaskol/serpmantic`
3. Configuration détectée automatiquement (grâce à `vercel.json`)
4. Ajouter les variables d'environnement (étape 2)
5. Cliquer **"Deploy"**

**Option 2 : Via CLI**

```bash
# Installer Vercel CLI
pnpm install -g vercel

# Login
vercel login

# Déployer
vercel --prod
```

### Étape 4 : Déployer le service NLP (Python)

Le service NLP doit être déployé séparément sur **Render.com** (gratuit) :

1. Aller sur [render.com](https://render.com)
2. New > Web Service
3. Connecter le repo GitHub : `neaskol/serpmantic`
4. Configuration :
   ```
   Root Directory: services/nlp
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Créer le service (gratuit, 750h/mois)
6. Copier l'URL (ex: `https://serpmantic-nlp.onrender.com`)
7. Ajouter cette URL dans Vercel comme `NLP_SERVICE_URL`

### Étape 5 : Vérification post-déploiement

Une fois déployé :

1. **Health check** : `https://votre-app.vercel.app/api/health`

   Devrait retourner :
   ```json
   {
     "status": "ok",
     "services": {
       "redis": "connected",
       "database": "connected"
     }
   }
   ```

2. **Test création de guide** : `/dashboard` > "Créer un guide"

3. **Test analyse sémantique** : Créer un guide et voir si le score s'affiche

---

## 🎯 Recommandations

### Pour le MVP (gratuit)

**Stack recommandée** :

| Service | Solution | Coût |
|---------|----------|------|
| Frontend | Vercel | Gratuit |
| Backend NLP | Render.com | Gratuit |
| Database | Supabase | Gratuit |
| Cache | Upstash | Gratuit |
| LLM | **Groq** | Gratuit ✅ |
| SERP | Custom scraper | Gratuit |

**Total : $0/mois**

### Pour la production (payant)

Une fois que vous avez des utilisateurs payants :

| Service | Plan | Coût estimé |
|---------|------|-------------|
| Vercel | Pro | $20/mois |
| Render | Starter (no sleep) | $7/mois |
| Supabase | Pro | $25/mois |
| Upstash | Pro 2K | $10/mois |
| Claude/GPT | Pay-as-you-go | $20-50/mois |
| SerpAPI | 5k recherches | $50/mois |

**Total : ~$130-160/mois**

---

## 🚀 Actions immédiates

1. **Corriger Supabase** (5 min)
   - Aller sur supabase.com
   - Resume la base si pausée
   - Retester avec `node scripts/test-all-apis.js`

2. **Ajouter variables dans Vercel** (10 min)
   - Copier toutes les variables de `.env.local`
   - Settings > Environment Variables

3. **Déployer frontend** (2 min)
   - Via vercel.com/new ou `vercel --prod`

4. **Déployer NLP service** (5 min)
   - Sur render.com (gratuit)

5. **Tester en production** (2 min)
   - `/api/health`
   - Créer un guide de test

**Temps total estimé : 25 minutes**

---

## 📞 Support

- **Documentation Vercel** : [vercel.com/docs](https://vercel.com/docs)
- **Documentation Supabase** : [supabase.com/docs](https://supabase.com/docs)
- **Documentation Groq** : [console.groq.com/docs](https://console.groq.com/docs)
- **Guide complet** : `docs/SETUP-UPSTASH.md`
- **Guide gratuit** : `DEPLOYMENT-FREE-TIER.md`

---

**Prêt à déployer ? 🚀**

Commencez par corriger Supabase, puis suivez les étapes ci-dessus.
