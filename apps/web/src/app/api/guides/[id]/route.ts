import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateGuideSchema, formatZodError } from '@/lib/schemas'
import { ZodError } from 'zod'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Optimized: fetch guide with all related data in one query
  const { data, error } = await supabase
    .from('guides')
    .select(`
      *,
      serp_analyses (
        *,
        serp_pages (*),
        semantic_terms (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
  }

  // Transform nested structure for backward compatibility
  const guide = data
  const analysis = data.serp_analyses?.[0] || null
  const pages = analysis?.serp_pages || []
  const terms = analysis?.semantic_terms || []

  return NextResponse.json({ guide, analysis, pages, terms })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Validate request body with Zod
    const body = await request.json()
    const validatedData = UpdateGuideSchema.parse(body)

    const { data, error } = await supabase
      .from('guides')
      .update({ ...validatedData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodError(error)
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('guides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
