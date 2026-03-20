#!/usr/bin/env node

/**
 * Test Supabase connection
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

console.log('🔍 Testing Supabase Connection...\n')

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL not found')
  process.exit(1)
}

if (!supabaseAnonKey) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_ANON_KEY not found')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY not found')
  process.exit(1)
}

console.log('✓ Environment variables loaded')
console.log(`  - URL: ${supabaseUrl}`)
console.log(`  - Anon key: ${supabaseAnonKey.slice(0, 20)}...`)
console.log(`  - Service key: ${supabaseServiceKey.slice(0, 20)}...\n`)

// Test Supabase connection
try {
  const { createClient } = await import('@supabase/supabase-js')

  console.log('Testing connection with anon key...')
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Test a simple query
  const { data, error } = await supabase
    .from('guides')
    .select('id')
    .limit(1)

  if (error) {
    console.error('✗ Supabase query failed:', error.message)
    console.error('  Error details:', error)
    process.exit(1)
  }

  console.log('✓ Supabase connection successful')
  console.log(`  - Found ${data?.length || 0} guide(s)\n`)

  // Test with service role key
  console.log('Testing connection with service role key...')
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('guides')
    .select('id, keyword')
    .limit(3)

  if (adminError) {
    console.error('✗ Admin query failed:', adminError.message)
    console.error('  Error details:', adminError)
  } else {
    console.log('✓ Service role connection successful')
    console.log(`  - Found ${adminData?.length || 0} guide(s)`)
    if (adminData && adminData.length > 0) {
      console.log('  - Sample guides:', adminData.map(g => `${g.id} (${g.keyword})`).join(', '))
    }
  }

  console.log('\n✅ Supabase connection test passed!\n')

} catch (error) {
  console.error('✗ Test failed:', error.message)
  console.error('Stack:', error.stack)
  process.exit(1)
}
