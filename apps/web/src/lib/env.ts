import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),

  // NLP Service
  NLP_SERVICE_URL: z.string().url('Invalid NLP service URL').optional().default('http://localhost:8001'),
  NLP_SERVICE_TIMEOUT: z.coerce.number().positive().optional().default(30000),

  // SERP API
  SERPAPI_KEY: z.string().min(1, 'SERP API key is required').optional(),

  // Upstash Redis (optional in development)
  UPSTASH_REDIS_REST_URL: z.string().url('Invalid Redis URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Redis token is required').optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().url('Invalid Sentry DSN').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url('Invalid public Sentry DSN').optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      console.error(error.message)
      throw new Error('Invalid environment configuration')
    }
    throw error
  }
}

// Call validation on app startup (except in tests)
let env: Env | null = null

if (process.env.NODE_ENV !== 'test') {
  env = validateEnv()
}

export { env }
