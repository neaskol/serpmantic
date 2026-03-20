import { NextResponse } from 'next/server'

/**
 * GET /api/textrazor/usage
 *
 * Returns TextRazor API usage statistics by querying the NLP service.
 * The NLP service tracks usage internally.
 */
export async function GET() {
  try {
    const nlpServiceUrl = process.env.NLP_SERVICE_URL || 'http://localhost:8080'

    // Call the NLP service to get usage stats
    const response = await fetch(`${nlpServiceUrl}/textrazor/usage`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`NLP service returned ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      daily_limit: 500,
      requests_today: data.requests_today || 0,
      requests_remaining: Math.max(0, 500 - (data.requests_today || 0)),
      reset_at: data.reset_at || null,
      percentage_used: Math.min(100, ((data.requests_today || 0) / 500) * 100),
    })
  } catch (error) {
    console.error('Failed to fetch TextRazor usage:', error)

    // Return mock data if the service is unavailable
    return NextResponse.json({
      daily_limit: 500,
      requests_today: 0,
      requests_remaining: 500,
      reset_at: null,
      percentage_used: 0,
      error: 'Unable to fetch usage data',
    })
  }
}
