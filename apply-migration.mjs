#!/usr/bin/env node

/**
 * Apply the missing headings column migration
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, 'apps/web/.env.local')

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

console.log('🔧 Applying missing database migration...\n')

try {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('Step 1: Checking if headings column exists...')

  // Try to query the column
  const { error: checkError } = await supabase
    .from('serp_pages')
    .select('headings')
    .limit(1)

  if (!checkError) {
    console.log('✓ headings column already exists!')
    console.log('\nThe migration has already been applied.')
    process.exit(0)
  }

  console.log('✗ headings column does not exist')
  console.log('  Error:', checkError.message)

  console.log('\nStep 2: Applying migration...')

  const migrationSQL = `
    ALTER TABLE public.serp_pages
    ADD COLUMN headings JSONB DEFAULT '[]' NOT NULL;
  `

  const { error: migrationError } = await supabase.rpc('exec_sql', {
    sql: migrationSQL
  })

  if (migrationError) {
    console.error('✗ Migration failed with rpc method')
    console.error('  Error:', migrationError.message)
    console.log('\n⚠️  You need to apply this migration manually via Supabase Dashboard:')
    console.log('\n1. Go to: https://sycxauunnhshuhehsafl.supabase.co')
    console.log('2. Click on "SQL Editor"')
    console.log('3. Run this SQL:\n')
    console.log(migrationSQL)
    process.exit(1)
  }

  console.log('✓ Migration applied successfully!')

  console.log('\nStep 3: Verifying migration...')
  const { data, error: verifyError } = await supabase
    .from('serp_pages')
    .select('id, headings')
    .limit(1)

  if (verifyError) {
    console.error('✗ Verification failed:', verifyError.message)
    process.exit(1)
  }

  console.log('✓ Migration verified!')
  console.log('\n✅ Database migration completed successfully!')

} catch (error) {
  console.error('✗ Migration failed:', error.message)
  console.error('Stack:', error.stack)
  process.exit(1)
}
