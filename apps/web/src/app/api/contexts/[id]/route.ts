import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateContextSchema } from '@/lib/schemas'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
import { logger } from '@/lib/logger'

// PATCH /api/contexts/[id] — Update context
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await request.json()
    const validated = UpdateContextSchema.parse(body)

    const { data, error } = await supabase
      .from('prompt_contexts')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update context' }, { status: 500 })
    return NextResponse.json({ context: data })
  } catch (error) {
    return handleApiError(error, { route: `/api/contexts/${id}`, context: { requestId } })
  } finally {
    logger.clearRequestId()
  }
}

// DELETE /api/contexts/[id] — Delete context
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('prompt_contexts')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: 'Failed to delete context' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, { route: `/api/contexts/${id}`, context: { requestId } })
  } finally {
    logger.clearRequestId()
  }
}
