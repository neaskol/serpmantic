# Guide de déploiement Vercel - SERPmantics

## Prérequis

1. Compte Vercel (gratuit pour commencer)
2. GitHub repository déjà connecté (✅ fait)
3. Variables d'environnement configurées

## Configuration des services externes

### 1. Supabase (Base de données + Auth)
- Créer un projet sur [supabase.com](https://supabase.com)
- Récupérer : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 2. Anthropic (Claude LLM)
- API key sur [console.anthropic.com](https://console.anthropic.com)
- Variable : `ANTHROPIC_API_KEY`

### 3. OpenAI (GPT LLM)
- API key sur [platform.openai.com](https://platform.openai.com)
- Variable : `OPENAI_API_KEY`

### 4. SerpAPI (Crawl SERP)
- API key sur [serpapi.com](https://serpapi.com)
- Variable : `SERPAPI_KEY`

### 5. Upstash Redis (Rate limiting + Cache)
- Créer une base Redis sur [console.upstash.com](https://console.upstash.com)
- Récupérer : `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`

### 6. NLP Service (à déployer séparément)
- Déployer `services/nlp` sur Railway/Render
- Variable : `NLP_SERVICE_URL`

## Déploiement sur Vercel

### Option 1 : Interface Web (Recommandée)

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer le repository : `neaskol/serpmantic`
3. Configuration du projet :
   - **Framework Preset** : Next.js
   - **Root Directory** : `.` (laisser vide)
   - **Build Command** : `cd apps/web && pnpm install && pnpm build`
   - **Output Directory** : `apps/web/.next`
   - **Install Command** : `pnpm install`

4. Ajouter les variables d'environnement (voir `.env.example`)

5. Cliquer sur **Deploy**

### Option 2 : CLI Vercel

```bash
# Installer Vercel CLI
pnpm install -g vercel

# Login
vercel login

# Déployer
vercel

# Ou déployer en production directement
vercel --prod
```

## Configuration post-déploiement

1. **Vérifier le health check** : `https://votre-app.vercel.app/api/health`
2. **Configurer le domaine custom** (optionnel)
3. **Activer Vercel Analytics** (recommandé)
4. **Configurer les limites de rate** dans Upstash

## Variables d'environnement Vercel

Dans Vercel Dashboard > Project > Settings > Environment Variables :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-proj-xxx

# SERP API
SERPAPI_KEY=xxx

# Upstash Redis
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# NLP Service (déployer sur Railway/Render)
NLP_SERVICE_URL=https://your-nlp-service.railway.app
```

## Déploiement du service NLP (séparé)

Le service NLP Python (`services/nlp`) doit être déployé séparément :

### Railway

1. Aller sur [railway.app](https://railway.app)
2. Créer un nouveau projet
3. Connecter le repo GitHub
4. Sélectionner le dossier `services/nlp`
5. Railway détectera automatiquement Python/FastAPI

### Render

1. Aller sur [render.com](https://render.com)
2. New > Web Service
3. Connecter le repo GitHub
4. **Build Command** : `cd services/nlp && pip install -r requirements.txt`
5. **Start Command** : `cd services/nlp && uvicorn main:app --host 0.0.0.0 --port $PORT`

## Monitoring

- **Vercel Analytics** : suivi des performances front
- **Vercel Logs** : logs en temps réel
- **Upstash Console** : métriques Redis
- **Supabase Dashboard** : requêtes DB

## Troubleshooting

### Build fail : "Module not found"
- Vérifier que `pnpm install` s'exécute bien dans `apps/web`
- Check `vercel.json` > `buildCommand`

### Runtime error : "SUPABASE_URL is not defined"
- Vérifier que les variables d'environnement sont bien configurées
- Attention : variables `NEXT_PUBLIC_*` doivent être définies au build time

### API timeout
- Augmenter les limites de timeout Vercel (plan Pro requis pour > 10s)
- Optimiser les requêtes SERP/NLP

## Liens utiles

- [Documentation Vercel](https://vercel.com/docs)
- [Monorepo avec Vercel](https://vercel.com/docs/monorepos)
- [Next.js 15 sur Vercel](https://vercel.com/docs/frameworks/nextjs)
