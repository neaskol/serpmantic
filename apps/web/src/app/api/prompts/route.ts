import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, description, llm_provider, model_id, task_type, scope, is_public, category')
    .eq('is_public', true)
    .order('category', { ascending: true })
    .order('title', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }

  return NextResponse.json({ prompts: data })
}
