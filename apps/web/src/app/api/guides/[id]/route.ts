import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: guide, error } = await supabase
    .from('guides')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !guide) return NextResponse.json({ error: 'Guide not found' }, { status: 404 })

  // Also fetch SERP analysis, pages, and terms
  const { data: analysis } = await supabase
    .from('serp_analyses')
    .select('*')
    .eq('guide_id', id)
    .single()

  let pages = null
  let terms = null

  if (analysis) {
    const { data: p } = await supabase
      .from('serp_pages')
      .select('*')
      .eq('serp_analysis_id', analysis.id)
      .order('position')

    const { data: t } = await supabase
      .from('semantic_terms')
      .select('*')
      .eq('serp_analysis_id', analysis.id)
      .order('importance', { ascending: false })

    pages = p
    terms = t
  }

  return NextResponse.json({ guide, analysis, pages, terms })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('guides')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('guides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
