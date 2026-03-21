import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

/**
 * Get SERP job status endpoint
 * Used by frontend for polling job progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get job with related analysis data if completed
    const { data: job, error: jobError } = await supabase
      .from('serp_jobs')
      .select(`
        *,
        guides!inner(id, keyword)
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If job is completed, fetch the analysis results
    let analysisData = null
    if (job.status === 'completed') {
      const { data: analysis } = await supabase
        .from('serp_analyses')
        .select(`
          *,
          serp_pages(*),
          semantic_terms(*)
        `)
        .eq('guide_id', job.guide_id)
        .single()

      if (analysis) {
        const { serp_pages, semantic_terms, ...cleanAnalysis } = analysis
        analysisData = {
          analysis: cleanAnalysis,
          pages: serp_pages || [],
          terms: semantic_terms || [],
        }
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progressStep: job.progress_step,
      error: job.error_message,
      errorDetails: job.error_details,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      data: analysisData,
    })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/serp/job-status',
      context: {},
    })
  }
}
