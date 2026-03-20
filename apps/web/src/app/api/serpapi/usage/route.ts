import { NextResponse } from 'next/server'
import { getSerpApiUsage } from '@/lib/serpapi-tracker'

/**
 * GET /api/serpapi/usage
 *
 * Returns SerpAPI usage statistics.
 * Tracks requests in-memory with automatic daily reset.
 */
export async function GET() {
  try {
    const usage = getSerpApiUsage()

    return NextResponse.json({
      requests_today: usage.requests_today,
      daily_average: usage.daily_average,
      monthly_limit: usage.monthly_limit,
      requests_remaining_today: usage.requests_remaining_today,
      reset_at: usage.reset_at,
      percentage_used: usage.percentage_used,
      last_reset: usage.last_reset,
    })
  } catch (error) {
    console.error('Failed to fetch SerpAPI usage:', error)

    // Return default values on error
    return NextResponse.json({
      requests_today: 0,
      daily_average: 3,
      monthly_limit: 100,
      requests_remaining_today: 3,
      reset_at: null,
      percentage_used: 0,
      error: 'Unable to fetch usage data',
    })
  }
}
