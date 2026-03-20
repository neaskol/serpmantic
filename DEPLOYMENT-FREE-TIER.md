# Guide des services GRATUITS pour SERPmantics

## 🎯 Objectif : Déployer sans payer

Voici les alternatives gratuites pour chaque service requis.

---

## 1. 🚀 Hébergement Frontend (Vercel)

**✅ GRATUIT** - Tier Hobby (généreux)

- **Limites** :
  - 100 GB bande passante/mois
  - Builds illimités
  - Déploiements illimités
  - 1 équipe, projets illimités
  - Analytics de base

- **Lien** : [vercel.com](https://vercel.com/pricing)

**Aucune carte bancaire requise** ✅

---

## 2. 🐍 Hébergement Backend NLP (Python FastAPI)

### Option A : **Render.com** (Recommandé)

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 750h/mois (suffisant pour 1 service)
  - 512 MB RAM
  - Le service se met en veille après 15 min d'inactivité (démarrage ~30-60s)
  - Redémarre automatiquement à la première requête

- **Lien** : [render.com](https://render.com/pricing)
- **Aucune carte bancaire requise** ✅

**Configuration Render** :
```yaml
# render.yaml (à créer)
services:
  - type: web
    name: serpmantic-nlp
    runtime: python
    buildCommand: pip install -r services/nlp/requirements.txt
    startCommand: uvicorn services.nlp.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.11
```

### Option B : **Railway**

**⚠️ Quasi-gratuit** - $5 de crédit gratuit/mois

- **Limites** :
  - $5 de crédit offert (renouvelé chaque mois)
  - ~500h d'exécution avec service léger
  - Pas de mise en veille automatique

- **Lien** : [railway.app](https://railway.app/pricing)
- **Carte bancaire requise** (mais pas de charge si < $5/mois) ⚠️

### Option C : **Fly.io**

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 3 VM partagées (256 MB RAM chacune)
  - 160 GB bande passante sortante/mois
  - Pas de mise en veille

- **Lien** : [fly.io](https://fly.io/docs/about/pricing/)
- **Carte bancaire requise** ⚠️

### Option D : **PythonAnywhere**

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 1 app web
  - 512 MB espace disque
  - 100 secondes CPU/jour (très limité)
  - Domaine : `username.pythonanywhere.com`

- **Lien** : [pythonanywhere.com](https://www.pythonanywhere.com/pricing/)
- **Aucune carte bancaire requise** ✅

---

## 3. 🗄️ Base de données (Supabase)

**✅ GRATUIT** - Free Tier (très généreux)

- **Limites** :
  - 500 MB stockage
  - 2 GB bande passante/mois
  - 50k utilisateurs authentifiés
  - Database PostgreSQL complète
  - API auto-générée

- **Lien** : [supabase.com](https://supabase.com/pricing)
- **Aucune carte bancaire requise** ✅

---

## 4. 🔴 Redis (Cache + Rate Limiting)

### Option A : **Upstash Redis** (Recommandé)

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 10k requêtes/jour
  - 256 MB stockage
  - Latence globale optimisée

- **Lien** : [console.upstash.com](https://console.upstash.com)
- **Aucune carte bancaire requise** ✅

### Option B : **Redis Cloud** (Redis Labs)

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 30 MB stockage
  - 30 connexions simultanées
  - Pas de carte bancaire

- **Lien** : [redis.com](https://redis.com/try-free/)

---

## 5. 🤖 LLM APIs

### Anthropic (Claude)

**💰 PAYANT** - Pay-as-you-go

- **Prix** :
  - Claude 3.5 Sonnet : $3/M tokens input, $15/M tokens output
  - Claude 3 Haiku : $0.25/M tokens input, $1.25/M tokens output

- **Crédit gratuit** : $5 à l'inscription (temporaire)
- **Lien** : [console.anthropic.com](https://console.anthropic.com)

### OpenAI (GPT)

**💰 PAYANT** - Pay-as-you-go

- **Prix** :
  - GPT-4o : $2.50/M tokens input, $10/M tokens output
  - GPT-4o-mini : $0.15/M tokens input, $0.60/M tokens output

- **Crédit gratuit** : $5 pendant 3 mois (nouveaux comptes)
- **Lien** : [platform.openai.com](https://platform.openai.com)

### 🆓 Alternative gratuite : **Groq**

**✅ GRATUIT** - Limites généreuses

- **Modèles** :
  - Llama 3.1 70B
  - Mixtral 8x7B
  - Gemma 2 9B

- **Limites** :
  - 14,400 requêtes/jour
  - 30 requêtes/minute
  - Ultra-rapide (inférence optimisée)

- **Lien** : [console.groq.com](https://console.groq.com)
- **Aucune carte bancaire requise** ✅

**Alternative au code** :
```typescript
// Remplacer Anthropic/OpenAI par Groq
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const completion = await groq.chat.completions.create({
  model: "llama-3.1-70b-versatile",
  messages: [{ role: "user", content: "Generate H2/H3 outline..." }]
});
```

---

## 6. 🔍 SERP API (Google Search Results)

### Option A : **SerpAPI**

**⚠️ Limité gratuit** - Free Tier

- **Limites** :
  - 100 recherches/mois gratuites
  - Puis $50/5k recherches

- **Lien** : [serpapi.com](https://serpapi.com/pricing)

### Option B : **ScraperAPI** (Alternative)

**✅ GRATUIT** - Free Tier

- **Limites** :
  - 5,000 appels API/mois
  - Proxy rotatifs inclus

- **Lien** : [scraperapi.com](https://www.scraperapi.com/pricing/)
- **Carte bancaire requise** ⚠️

### Option C : **Custom Scraper** (100% gratuit)

**✅ TOTALEMENT GRATUIT**

Utiliser Puppeteer/Playwright directement :

```typescript
// apps/web/src/lib/serp-scraper.ts
import puppeteer from 'puppeteer';

export async function getSerpResults(query: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

  const results = await page.$$eval('.g', elements =>
    elements.map(el => ({
      title: el.querySelector('h3')?.textContent,
      url: el.querySelector('a')?.href,
      snippet: el.querySelector('.VwiC3b')?.textContent
    }))
  );

  await browser.close();
  return results;
}
```

**⚠️ Attention** : Google peut bloquer si trop de requêtes. Utiliser avec modération.

---

## 📊 Stack 100% gratuite recommandée

| Service | Solution | Limite |
|---------|----------|--------|
| **Frontend** | Vercel | 100 GB/mois |
| **Backend NLP** | Render.com | 750h/mois |
| **Database** | Supabase | 500 MB |
| **Redis** | Upstash | 10k requêtes/jour |
| **LLM** | Groq | 14k requêtes/jour |
| **SERP** | Custom Scraper | Illimité (avec rate limit) |

**Total : $0/mois** ✅

---

## ⚡ Déploiement express (gratuit)

### 1. Créer les comptes (5 min)

```bash
# Vercel
https://vercel.com/signup

# Render
https://render.com/register

# Supabase
https://supabase.com/dashboard/sign-up

# Upstash
https://console.upstash.com/login

# Groq (remplacer Claude/GPT)
https://console.groq.com/login
```

### 2. Déployer le frontend (2 min)

```bash
# Via l'interface Vercel
https://vercel.com/new
# Importer : neaskol/serpmantic
```

### 3. Déployer le backend NLP (3 min)

**Sur Render** :
1. New > Web Service
2. Connecter GitHub repo
3. **Root Directory** : `services/nlp`
4. **Build Command** : `pip install -r requirements.txt`
5. **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 4. Configurer les variables d'environnement

Dans Vercel > Settings > Environment Variables :

```bash
# Supabase (gratuit)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Groq (gratuit - remplace Claude/OpenAI)
GROQ_API_KEY=gsk_xxx

# Upstash Redis (gratuit)
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# NLP Service (gratuit sur Render)
NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com

# Pas de SERPAPI_KEY (utiliser custom scraper)
```

---

## 🎓 Limites des services gratuits

| Service | Problème gratuit | Solution |
|---------|------------------|----------|
| **Render** | Veille après 15 min | Acceptable (1ère requête = 30s) |
| **Groq** | Limité 30 req/min | Suffisant pour MVP |
| **Upstash** | 10k req/jour | OK avec cache intelligent |
| **Custom SERP** | Risque ban Google | Rate limit + rotating IPs |

---

## 🚀 Migration vers payant (plus tard)

Quand vous aurez des utilisateurs :

1. **Vercel Pro** ($20/mois) → Serverless functions illimitées
2. **Railway** ($5-20/mois) → Backend NLP toujours actif
3. **Anthropic/OpenAI** (pay-as-you-go) → Meilleure qualité LLM
4. **SerpAPI** ($50/5k) → SERP stable et légal
5. **Upstash Pro** ($10/mois) → Rate limit augmenté

**Total estimé avec trafic modéré** : ~$50-100/mois

---

## ✅ Checklist déploiement gratuit

- [ ] Compte Vercel créé
- [ ] Compte Render créé
- [ ] Compte Supabase créé
- [ ] Compte Upstash créé
- [ ] Compte Groq créé
- [ ] Remplacer Anthropic/OpenAI par Groq dans le code
- [ ] Implémenter custom SERP scraper
- [ ] Déployer frontend sur Vercel
- [ ] Déployer backend NLP sur Render
- [ ] Configurer les variables d'environnement
- [ ] Tester `/api/health`

---

## 📞 Support

Si un service gratuit ne fonctionne pas, ouvrez un ticket dans leur support (tous répondent rapidement).
