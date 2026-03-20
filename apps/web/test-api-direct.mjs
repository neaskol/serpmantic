#!/usr/bin/env node

/**
 * Test API endpoints directly (simulating server-side execution)
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '.env.local')

// Load environment variables
try {
  const envFile = readFileSync(envPath, 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
} catch (error) {
  console.error('Failed to load .env.local:', error.message)
  process.exit(1)
}

console.log('🔍 Testing API Plan Generation Logic...\n')

const GUIDE_ID = 'b374fd51-1342-4c35-8a0c-f082f846af3c'

try {
  // Import the modules used by the API
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('Step 1: Loading guide...')
  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .select('keyword, language')
    .eq('id', GUIDE_ID)
    .single()

  if (guideError || !guide) {
    console.error('✗ Guide not found:', guideError?.message)
    process.exit(1)
  }

  console.log('✓ Guide loaded:', guide.keyword)

  console.log('\nStep 2: Loading SERP analysis...')
  const { data: serpAnalysis, error: serpError } = await supabase
    .from('serp_analyses')
    .select('id')
    .eq('guide_id', GUIDE_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (serpError) {
    console.error('✗ SERP analysis error:', serpError)
    console.error('  Error code:', serpError.code)
    console.error('  Error message:', serpError.message)

    if (serpError.code === 'PGRST116') {
      console.log('\n⚠️  No SERP analysis found. This is expected if you haven\'t run analysis yet.')
      console.log('   The API should return: "No SERP analysis found. Run analysis first."')
    }
    process.exit(0)
  }

  console.log('✓ SERP analysis found:', serpAnalysis.id)

  console.log('\nStep 3: Loading SERP pages...')
  const { data: serpPages, error: pagesError } = await supabase
    .from('serp_pages')
    .select('url, title, score, headings, is_excluded')
    .eq('serp_analysis_id', serpAnalysis.id)

  if (pagesError) {
    console.error('✗ SERP pages error:', pagesError.message)
    process.exit(1)
  }

  console.log(`✓ Loaded ${serpPages?.length || 0} SERP pages`)

  const competitors = (serpPages || [])
    .filter(page => !page.is_excluded)
    .map(page => ({
      url: page.url,
      title: page.title,
      headings: page.headings || [],
    }))

  console.log(`  - ${competitors.length} non-excluded pages`)
  console.log(`  - ${competitors.filter(c => c.headings.length > 2).length} with headings`)

  console.log('\nStep 4: Loading semantic terms...')
  const { data: semanticTerms, error: termsError } = await supabase
    .from('semantic_terms')
    .select('display_term, importance, is_to_avoid')
    .eq('serp_analysis_id', serpAnalysis.id)

  if (termsError) {
    console.error('✗ Semantic terms error:', termsError.message)
    process.exit(1)
  }

  console.log(`✓ Loaded ${semanticTerms?.length || 0} semantic terms`)

  const topTerms = (semanticTerms || [])
    .filter(term => !term.is_to_avoid)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 30)
    .map(term => term.display_term)

  console.log(`  - ${topTerms.length} top non-avoided terms`)

  console.log('\n✅ All data loaded successfully!')
  console.log('\nIf the API still fails, the error must be in:')
  console.log('1. AI SDK initialization (already tested - working)')
  console.log('2. Authentication/session handling')
  console.log('3. Next.js API route execution context')

  console.log('\nNext step: Check the terminal where `pnpm dev` is running for server errors.')

} catch (error) {
  console.error('✗ Test failed:', error.message)
  console.error('Stack:', error.stack)
  process.exit(1)
}
