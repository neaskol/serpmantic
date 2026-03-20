# Deployment Notes - SERP Analysis Solution ✅

## Problem (SOLVED)
Vercel Hobby plan has a **10-second maximum timeout** for serverless functions. Even with background jobs, the `/api/serp/process-job` endpoint times out because SERP analysis takes 30-90 seconds.

## Solution Deployed (March 20, 2026)

✅ **External Worker on Render.com (Free)**

### Architecture
```
User clicks "Analyser SERP"
    ↓
[Vercel] /api/serp/analyze-v2
    • Creates job in Supabase (status: 'pending')
    • Triggers external worker via HTTP (fire-and-forget)
    • Returns jobId immediately (202 Accepted)
    ↓
[Render.com] https://serpmantics-worker.onrender.com/process-serp-job
    • Receives jobId
    • Processes SERP analysis (NO TIMEOUT LIMITS!)
    • Updates job status in Supabase directly
    ↓
[Frontend] Polls /api/serp/job-status/[jobId] every 2s
    • Shows progress: fetching → crawling → nlp → saving
    • Displays results when status = 'completed'
```

### Deployment Details
- **Service Name**: serpmantics-worker
- **URL**: https://serpmantics-worker.onrender.com
- **Plan**: Free tier (no timeout limits)
- **Region**: Frankfurt
- **Auto-deploy**: Enabled (pushes to `main` branch)
- **Source**: `services/worker/` in GitHub repo

### Environment Variables (Render.com)
```env
SUPABASE_URL=https://sycxauunnhshuhehsafl.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci... (service role key)
NLP_SERVICE_URL=https://serpmantic-nlp.onrender.com
NODE_ENV=production
```

### Vercel Configuration
In `apps/web/.env.local` or Vercel dashboard:
```env
WORKER_SERVICE_URL=https://serpmantics-worker.onrender.com
```

## Benefits
✅ **No timeout limits** - Can process jobs for hours if needed
✅ **Free tier** - No additional cost
✅ **Full 10 pages** - Not limited to 6 pages anymore
✅ **Auto-deploy** - Updates on every push to main
✅ **Real-time updates** - Frontend polls job status

## Monitoring
- **Render Dashboard**: https://dashboard.render.com/web/srv-d6un43f5gffc73cs5o9g
- **Health check**: https://serpmantics-worker.onrender.com/health
- **Logs**: Available in Render dashboard

## Alternatives Considered

### Option 1: Vercel Pro ($20/month)
- ❌ Costs money
- ✅ Allows `maxDuration: 300` (5 minutes)
- ❌ Still has limits (not suitable for very long jobs)

### Option 2: Railway/Fly.io
- ✅ Similar to Render.com
- ❌ More complex setup
- ❌ Free tier more restrictive

## Previous Temporary Fixes (Now Removed)
- ~~Reduced crawl timeout: 15s → 8s~~
- ~~Limit pages: 10 → 6~~
- These restrictions are no longer needed with external worker!
