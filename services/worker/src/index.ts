import express from 'express'
import { processJob } from './process-job.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'serpmantics-worker' })
})

// Main worker endpoint - processes SERP analysis jobs
app.post('/process-serp-job', async (req, res) => {
  const { jobId } = req.body

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID required' })
  }

  console.log(`[Worker] Received job ${jobId}`)

  // Respond immediately - processing happens in background
  res.json({
    status: 'processing',
    jobId,
    message: 'Job started in background'
  })

  // Process in background (no timeout limits on Render!)
  processJob(jobId).catch(error => {
    console.error(`[Worker] Job ${jobId} failed:`, error)
  })
})

app.listen(PORT, () => {
  console.log(`[Worker] Running on port ${PORT}`)
  console.log(`[Worker] No timeout limits - can process jobs indefinitely`)
})
