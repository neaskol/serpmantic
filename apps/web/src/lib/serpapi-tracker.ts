/**
 * SerpAPI Usage Tracker
 *
 * Tracks SerpAPI requests in-memory with automatic daily reset.
 * In production, this should be replaced with Redis or database storage.
 */

interface UsageTracker {
  requests_today: number
  last_reset: string // ISO date string (YYYY-MM-DD)
}

// In-memory usage tracker (resets on server restart)
let serpApiUsageTracker: UsageTracker = {
  requests_today: 0,
  last_reset: new Date().toISOString().split('T')[0], // YYYY-MM-DD
}

/**
 * Get current date in YYYY-MM-DD format (UTC)
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Reset tracker if it's a new day
 */
function checkAndResetIfNeeded() {
  const currentDate = getCurrentDate()
  if (serpApiUsageTracker.last_reset !== currentDate) {
    serpApiUsageTracker.requests_today = 0
    serpApiUsageTracker.last_reset = currentDate
  }
}

/**
 * Track a SerpAPI request
 * Call this function every time you make a SerpAPI call
 */
export function trackSerpApiRequest() {
  checkAndResetIfNeeded()
  serpApiUsageTracker.requests_today += 1
}

/**
 * Get current SerpAPI usage statistics
 */
export function getSerpApiUsage() {
  checkAndResetIfNeeded()

  // Calculate next reset time (midnight UTC tomorrow)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)

  // SerpAPI free tier: 100 searches/month
  // Assuming ~3 searches/day average
  const MONTHLY_LIMIT = 100
  const DAILY_AVERAGE = Math.floor(MONTHLY_LIMIT / 30) // ~3 per day

  return {
    requests_today: serpApiUsageTracker.requests_today,
    daily_average: DAILY_AVERAGE,
    monthly_limit: MONTHLY_LIMIT,
    requests_remaining_today: Math.max(0, DAILY_AVERAGE - serpApiUsageTracker.requests_today),
    reset_at: tomorrow.toISOString(),
    last_reset: serpApiUsageTracker.last_reset,
    percentage_used: Math.min(100, (serpApiUsageTracker.requests_today / DAILY_AVERAGE) * 100),
  }
}

/**
 * Reset usage tracker (for testing purposes)
 */
export function resetSerpApiUsage() {
  serpApiUsageTracker.requests_today = 0
  serpApiUsageTracker.last_reset = getCurrentDate()
}
