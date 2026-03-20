# SERPmantics Worker Service

Worker service sans limite de timeout pour l'analyse SERP. Déployé sur Render.com.

## Architecture

- **Vercel** → Crée le job + polling du statut (10s max)
- **Render.com** → Traite le job en arrière-plan (AUCUNE limite de temps)
- **Supabase** → Stocke le statut du job et les résultats

## Variables d'environnement requises

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
NLP_SERVICE_URL=https://your-nlp-service.railway.app
```

## Endpoints

- `GET /health` - Health check
- `POST /process-serp-job` - Lance le traitement d'un job SERP
  ```json
  {
    "jobId": "uuid-du-job"
  }
  ```

## Déploiement sur Render.com

1. Créer un Web Service sur https://dashboard.render.com
2. Connecter ce repo GitHub
3. Configurer :
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: Ajouter SUPABASE_URL, SUPABASE_SERVICE_KEY, NLP_SERVICE_URL
4. Plan: **Free** (suffisant, pas de timeout)

## Utilisation depuis Vercel

Dans `/api/serp/analyze-v2/route.ts`, remplacer l'appel local par :

```typescript
fetch(`${process.env.WORKER_SERVICE_URL}/process-serp-job`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId: job.id }),
})
```

Ajouter la variable `WORKER_SERVICE_URL` dans Vercel :
```
WORKER_SERVICE_URL=https://serpmantics-worker.onrender.com
```
