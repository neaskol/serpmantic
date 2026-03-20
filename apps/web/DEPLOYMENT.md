# Deployment Notes - SERP Analysis Timeout Issue

## Problem
Vercel Hobby plan has a **10-second maximum timeout** for serverless functions. Even with background jobs, the `/api/serp/process-job` endpoint times out because SERP analysis takes 30-90 seconds.

## Current Situation
- ✅ Frontend: Async job creation + polling (works)
- ✅ Database: `serp_jobs` table created (works)
- ❌ Backend: Worker endpoint times out after 10s on Hobby plan

## Solutions

### Option 1: Upgrade to Vercel Pro ($20/month)
- Allows `maxDuration: 300` (5 minutes)
- **Quickest solution**
- Modify `vercel.json`:
  ```json
  {
    "functions": {
      "apps/web/src/app/api/serp/process-job/route.ts": {
        "maxDuration": 300
      }
    }
  }
  ```

### Option 2: Deploy Worker on External Service (Free)
Deploy `/api/serp/process-job` logic on:
- **Render.com** (free tier, no timeout)
- **Railway.app** (free tier with limits)
- **Fly.io** (free tier)

Steps:
1. Extract worker logic to standalone service
2. Host on Render/Railway
3. Call external worker from `/api/serp/analyze-v2`
4. Worker updates Supabase directly

### Option 3: Use Vercel Cron (Requires Pro)
Not available on Hobby plan.

### Option 4: Client-Side Long Polling (Current Workaround)
Keep optimizations:
- Crawl only 6 pages instead of 10
- 8-second timeout per page
- Pray it finishes in < 60 seconds

## Recommended: Option 2 (Free External Worker)

Create a simple worker service:

\`\`\`typescript
// worker-service/index.ts
import express from 'express'
import { processJob } from './serp-processor' // Move logic here

const app = express()
app.use(express.json())

app.post('/process-serp-job', async (req, res) => {
  const { jobId } = req.body

  // No timeout limits on Render!
  res.json({ status: 'processing', jobId })

  // Process in background
  processJob(jobId).catch(console.error)
})

app.listen(3001)
\`\`\`

Deploy on Render.com, then modify `/api/serp/analyze-v2` to call it.

## Temporary Fix Applied
- Reduced crawl timeout: 15s → 8s
- Limit pages: 10 → 6
- This might work for simple keywords but will still timeout on complex ones
