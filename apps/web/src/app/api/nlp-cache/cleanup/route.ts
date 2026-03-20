import { NextResponse } from 'next/server'
import { cleanExpiredNlpCache } from '@/lib/nlp-cache'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/nlp-cache/cleanup
 * Purges NLP cache entries older than 7 days.
 * Call periodically (e.g., daily cron) or manually.
 */
export async function DELETE() {
  try {
    const deleted = await cleanExpiredNlpCache()
    logger.info('NLP cache cleanup completed', { deleted })
    return NextResponse.json({ deleted })
  } catch (error) {
    logger.error('NLP cache cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}
