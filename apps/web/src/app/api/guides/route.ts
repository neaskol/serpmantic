import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateGuideSchema, formatZodError } from '@/lib/schemas'
import { ZodError } from 'zod'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('guides')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Create guide request', { requestId })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Validate request body with Zod
    const body = await request.json()
    const validatedData = CreateGuideSchema.parse(body)

    const { keyword, language, searchEngine } = validatedData

    const { data, error } = await supabase
      .from('guides')
      .insert({
        user_id: user.id,
        keyword,
        language,
        search_engine: searchEngine,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info('Guide created', {
      guideId: data.id,
      keyword: validatedData.keyword,
      language: validatedData.language,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleApiError(error, {
      route: '/api/guides',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
