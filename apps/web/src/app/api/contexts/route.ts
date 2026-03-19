import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateContextSchema } from '@/lib/schemas'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

// GET /api/contexts — List user's contexts
export async function GET() {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('prompt_contexts')
      .select('id, name, audience, tone, sector, brief, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Failed to load contexts' }, { status: 500 })
    return NextResponse.json({ contexts: data })
  } catch (error) {
    return handleApiError(error, { route: '/api/contexts', context: { requestId } })
  } finally {
    logger.clearRequestId()
  }
}

// POST /api/contexts — Create new context
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await request.json()
    const validated = CreateContextSchema.parse(body)

    const { data, error } = await supabase
      .from('prompt_contexts')
      .insert({ ...validated, user_id: user.id })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create context', { error: error.message })
      return NextResponse.json({ error: 'Failed to create context' }, { status: 500 })
    }

    return NextResponse.json({ context: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error, { route: '/api/contexts', context: { requestId } })
  } finally {
    logger.clearRequestId()
  }
}
