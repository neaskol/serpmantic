import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Refresh auth session so RLS authenticated policy works
  await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, description, llm_provider, model_id, task_type, scope, is_public, category')
    .eq('is_public', true)
    .order('category', { ascending: true })
    .order('title', { ascending: true })

  if (error) {
    console.error('[/api/prompts] Supabase error:', error.message)
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }

  return NextResponse.json({ prompts: data })
}
