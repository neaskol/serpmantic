# SERPmantics MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a semantic SEO optimization SaaS with a TipTap editor, real-time scoring (0-120), and a SERP analysis panel — from an empty repo to a working MVP.

**Architecture:** Next.js 14 App Router monorepo with pnpm workspaces. Python FastAPI micro-service for NLP (spaCy + TF-IDF). Supabase for PostgreSQL + Auth. SerpApi for SERP data. Client-side scoring engine for real-time performance.

**Tech Stack:** Next.js 14, TipTap, Tailwind CSS, shadcn/ui, Zustand, react-resizable-panels, Supabase, Python FastAPI, spaCy, SerpApi, Cheerio, pnpm workspaces

---

## Task 1: Project scaffolding — monorepo + Next.js app

**Files:**
- Create: `package.json` (root workspace)
- Create: `pnpm-workspace.yaml`
- Create: `apps/web/` (Next.js app via create-next-app)
- Create: `services/nlp/` (empty dir for now)
- Create: `.gitignore`

**Step 1: Initialize git repo**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic"
git init
```

**Step 2: Create root package.json and pnpm workspace**

`package.json`:
```json
{
  "name": "serpmantic",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "dev:nlp": "cd services/nlp && uvicorn main:app --reload --port 8000"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
```

**Step 3: Scaffold Next.js app**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic"
pnpm dlx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

**Step 4: Create NLP service directory**

```bash
mkdir -p services/nlp
```

**Step 5: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
__pycache__/
*.pyc
.venv/
dist/
```

**Step 6: Install shadcn/ui in the Next.js app**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm dlx shadcn@latest init -d
```

**Step 7: Install core shadcn components**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm dlx shadcn@latest add tabs card badge progress tooltip scroll-area button input separator sheet dialog
```

**Step 8: Verify dev server starts**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic"
pnpm dev
```

Expected: Next.js dev server on http://localhost:3000

**Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold monorepo with Next.js 14, Tailwind, shadcn/ui"
```

---

## Task 2: Supabase setup — project + database schema

**Files:**
- Create: `apps/web/.env.local` (Supabase keys)
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `supabase/migrations/001_initial_schema.sql` (reference only — applied via Supabase MCP)

**Step 1: Create Supabase project**

Use Supabase MCP tool `create_project` to create a new project named "serpmantic" in the user's organization.

**Step 2: Apply database migration**

Use Supabase MCP tool `apply_migration` with this SQL:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  plan text default 'free' check (plan in ('free', 'pro', 'team')),
  credits_remaining int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Guide groups
create table public.guide_groups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- Guides
create table public.guides (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  keyword text not null,
  language text default 'fr' check (language in ('fr', 'en', 'it', 'de', 'es')),
  search_engine text default 'google.fr',
  content jsonb default '{}',
  meta_title text default '',
  meta_description text default '',
  linked_url text,
  group_id uuid references public.guide_groups(id) on delete set null,
  visibility text default 'private' check (visibility in ('private', 'read', 'edit')),
  share_token text unique,
  score int default 0 check (score >= 0 and score <= 120),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SERP analyses
create table public.serp_analyses (
  id uuid default uuid_generate_v4() primary key,
  guide_id uuid references public.guides(id) on delete cascade unique not null,
  keyword text not null,
  language text not null,
  analyzed_at timestamptz default now(),
  structural_benchmarks jsonb default '{}',
  refresh_interval_months int default 6,
  refresh_recommended_at timestamptz,
  created_at timestamptz default now()
);

-- SERP pages
create table public.serp_pages (
  id uuid default uuid_generate_v4() primary key,
  serp_analysis_id uuid references public.serp_analyses(id) on delete cascade not null,
  url text not null,
  title text not null,
  score int default 0,
  is_excluded boolean default false,
  metrics jsonb default '{}',
  term_occurrences jsonb default '{}',
  position int not null
);

-- Semantic terms
create table public.semantic_terms (
  id uuid default uuid_generate_v4() primary key,
  serp_analysis_id uuid references public.serp_analyses(id) on delete cascade not null,
  term text not null,
  display_term text not null,
  is_main_keyword boolean default false,
  min_occurrences int default 0,
  max_occurrences int default 0,
  importance float default 1.0,
  term_type text default 'unigram' check (term_type in ('unigram', 'bigram', 'trigram', 'phrase')),
  is_to_avoid boolean default false
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.guides enable row level security;
alter table public.serp_analyses enable row level security;
alter table public.serp_pages enable row level security;
alter table public.semantic_terms enable row level security;
alter table public.guide_groups enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Guides: users can CRUD their own guides
create policy "Users can view own guides" on public.guides for select using (auth.uid() = user_id);
create policy "Users can insert own guides" on public.guides for insert with check (auth.uid() = user_id);
create policy "Users can update own guides" on public.guides for update using (auth.uid() = user_id);
create policy "Users can delete own guides" on public.guides for delete using (auth.uid() = user_id);

-- SERP analyses: via guide ownership
create policy "Users can view own serp analyses" on public.serp_analyses for select
  using (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can insert own serp analyses" on public.serp_analyses for insert
  with check (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can update own serp analyses" on public.serp_analyses for update
  using (guide_id in (select id from public.guides where user_id = auth.uid()));
create policy "Users can delete own serp analyses" on public.serp_analyses for delete
  using (guide_id in (select id from public.guides where user_id = auth.uid()));

-- SERP pages: via serp_analysis → guide ownership
create policy "Users can view own serp pages" on public.serp_pages for select
  using (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));
create policy "Users can insert own serp pages" on public.serp_pages for insert
  with check (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));

-- Semantic terms: via serp_analysis → guide ownership
create policy "Users can view own semantic terms" on public.semantic_terms for select
  using (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));
create policy "Users can insert own semantic terms" on public.semantic_terms for insert
  with check (serp_analysis_id in (
    select sa.id from public.serp_analyses sa
    join public.guides g on sa.guide_id = g.id
    where g.user_id = auth.uid()
  ));

-- Guide groups
create policy "Users can view own guide groups" on public.guide_groups for select using (auth.uid() = user_id);
create policy "Users can insert own guide groups" on public.guide_groups for insert with check (auth.uid() = user_id);
create policy "Users can delete own guide groups" on public.guide_groups for delete using (auth.uid() = user_id);
```

**Step 3: Install Supabase client in Next.js**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add @supabase/supabase-js @supabase/ssr
```

**Step 4: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase project>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase project>
```

**Step 5: Create Supabase browser client**

`apps/web/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 6: Create Supabase server client**

`apps/web/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 7: Verify tables exist**

Use Supabase MCP `list_tables` to confirm all tables are created.

**Step 8: Run security advisors**

Use Supabase MCP `get_advisors` (type: security) to check RLS is properly configured.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: setup Supabase schema with profiles, guides, SERP analysis, RLS"
```

---

## Task 3: TypeScript types — shared types for the app

**Files:**
- Create: `apps/web/src/types/database.ts`

**Step 1: Generate types from Supabase**

Use Supabase MCP `generate_typescript_types` to get the types, then save them.

**Step 2: Create domain types**

`apps/web/src/types/database.ts`:
```typescript
// Re-export generated Supabase types + domain aliases

export type Guide = {
  id: string
  user_id: string
  keyword: string
  language: 'fr' | 'en' | 'it' | 'de' | 'es'
  search_engine: string
  content: Record<string, unknown>
  meta_title: string
  meta_description: string
  linked_url: string | null
  group_id: string | null
  visibility: 'private' | 'read' | 'edit'
  share_token: string | null
  score: number
  created_at: string
  updated_at: string
}

export type SerpAnalysis = {
  id: string
  guide_id: string
  keyword: string
  language: string
  analyzed_at: string
  structural_benchmarks: StructuralBenchmarks
  refresh_interval_months: number
  refresh_recommended_at: string | null
  created_at: string
}

export type StructuralBenchmarks = {
  words: { min: number; max: number }
  headings: { min: number; max: number }
  paragraphs: { min: number; max: number }
  links: { min: number; max: number }
  images: { min: number; max: number }
  videos: { min: number; max: number }
  tables: { min: number; max: number }
  lists: { min: number; max: number }
}

export type SerpPage = {
  id: string
  serp_analysis_id: string
  url: string
  title: string
  score: number
  is_excluded: boolean
  metrics: StructuralMetrics
  term_occurrences: Record<string, number>
  position: number
}

export type StructuralMetrics = {
  words: number
  headings: number
  paragraphs: number
  links: number
  images: number
  videos: number
  tables: number
  lists: number
}

export type SemanticTerm = {
  id: string
  serp_analysis_id: string
  term: string
  display_term: string
  is_main_keyword: boolean
  min_occurrences: number
  max_occurrences: number
  importance: number
  term_type: 'unigram' | 'bigram' | 'trigram' | 'phrase'
  is_to_avoid: boolean
}

export type TermStatus = {
  term: SemanticTerm
  count: number
  status: 'ok' | 'missing' | 'excess'
  delta: number // how many to add (positive) or remove (negative)
}

export type ScoreLabel = 'Mauvais' | 'Moyen' | 'Bon' | 'Excellent' | 'Sur-optimise'

export type ScoreResult = {
  score: number
  label: ScoreLabel
  color: string
  termStatuses: TermStatus[]
  structuralMetrics: StructuralMetrics
}
```

**Step 3: Commit**

```bash
git add apps/web/src/types/
git commit -m "feat: add TypeScript types for guides, SERP analysis, semantic terms"
```

---

## Task 4: Scoring engine — client-side real-time scoring

**Files:**
- Create: `apps/web/src/lib/scoring.ts`
- Create: `apps/web/src/lib/text-utils.ts`
- Create: `apps/web/src/lib/__tests__/scoring.test.ts`
- Create: `apps/web/src/lib/__tests__/text-utils.test.ts`

**Step 1: Install vitest**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add -D vitest @vitejs/plugin-react
```

Add to `apps/web/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 2: Write failing tests for text-utils**

`apps/web/src/lib/__tests__/text-utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { normalizeText, countOccurrences } from '../text-utils'

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('removes accents', () => {
    expect(normalizeText('énergie rénovation')).toBe('energie renovation')
  })

  it('handles mixed case and accents', () => {
    expect(normalizeText('Délégataire CEE')).toBe('delegataire cee')
  })
})

describe('countOccurrences', () => {
  it('counts unigram occurrences', () => {
    const text = 'energie solaire et energie eolienne et energie nucleaire'
    expect(countOccurrences(text, 'energie')).toBe(3)
  })

  it('counts bigram occurrences', () => {
    const text = 'renovation energetique et renovation energetique des batiments'
    expect(countOccurrences(text, 'renovation energetique')).toBe(2)
  })

  it('is case and accent insensitive', () => {
    const text = 'Énergie renouvelable et énergie solaire'
    expect(countOccurrences(normalizeText(text), 'energie')).toBe(2)
  })

  it('returns 0 when term not found', () => {
    expect(countOccurrences('hello world', 'foo')).toBe(0)
  })

  it('counts trigram occurrences', () => {
    const text = 'certificats d economies d energie pour les certificats d economies d energie'
    expect(countOccurrences(text, 'certificats d economies d energie')).toBe(2)
  })
})
```

**Step 3: Run test to verify it fails**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm test
```

Expected: FAIL — module not found

**Step 4: Implement text-utils**

`apps/web/src/lib/text-utils.ts`:
```typescript
/**
 * Normalize text: lowercase + remove accents (diacritics)
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Count non-overlapping occurrences of a term in text.
 * Both text and term should already be normalized.
 */
export function countOccurrences(text: string, term: string): number {
  if (!term || !text) return 0

  let count = 0
  let pos = 0

  while ((pos = text.indexOf(term, pos)) !== -1) {
    // Check word boundaries to avoid partial matches
    const before = pos === 0 ? ' ' : text[pos - 1]
    const after = pos + term.length >= text.length ? ' ' : text[pos + term.length]

    const isWordBoundaryBefore = /\s|[.,;:!?()[\]{}"']/.test(before) || pos === 0
    const isWordBoundaryAfter = /\s|[.,;:!?()[\]{}"']/.test(after) || pos + term.length === text.length

    if (isWordBoundaryBefore && isWordBoundaryAfter) {
      count++
    }
    pos += term.length
  }

  return count
}
```

**Step 5: Run tests to verify they pass**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm test
```

Expected: all text-utils tests PASS

**Step 6: Write failing tests for scoring engine**

`apps/web/src/lib/__tests__/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateScore, getScoreLabel, getScoreColor } from '../scoring'
import type { SemanticTerm } from '@/types/database'

const mockTerms: SemanticTerm[] = [
  {
    id: '1', serp_analysis_id: 'sa1', term: 'energie', display_term: 'énergie',
    is_main_keyword: true, min_occurrences: 5, max_occurrences: 10,
    importance: 2.0, term_type: 'unigram', is_to_avoid: false,
  },
  {
    id: '2', serp_analysis_id: 'sa1', term: 'renovation energetique', display_term: 'rénovation énergétique',
    is_main_keyword: false, min_occurrences: 2, max_occurrences: 5,
    importance: 1.5, term_type: 'bigram', is_to_avoid: false,
  },
  {
    id: '3', serp_analysis_id: 'sa1', term: 'cookies', display_term: 'cookies',
    is_main_keyword: false, min_occurrences: 0, max_occurrences: 0,
    importance: 1.0, term_type: 'unigram', is_to_avoid: true,
  },
]

describe('calculateScore', () => {
  it('returns 0 for empty text', () => {
    const result = calculateScore('', mockTerms)
    expect(result.score).toBe(0)
  })

  it('returns perfect score when all terms are in range', () => {
    // 7x energie (in 5-10) + 3x renovation energetique (in 2-5)
    const text = 'energie energie energie energie energie energie energie renovation energetique renovation energetique renovation energetique'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBe(120)
  })

  it('returns partial score when terms are below range', () => {
    // 2x energie (below 5-10 min) → partial
    const text = 'energie energie'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(120)
  })

  it('caps score at 120', () => {
    const text = 'energie energie energie energie energie energie energie renovation energetique renovation energetique renovation energetique'
    const result = calculateScore(text, mockTerms)
    expect(result.score).toBeLessThanOrEqual(120)
  })

  it('penalizes over-optimized terms', () => {
    // 15x energie (way above max 10) → penalty
    const text = Array(15).fill('energie').join(' ')
    const result = calculateScore(text, mockTerms)
    const normalText = Array(7).fill('energie').join(' ')
    const normalResult = calculateScore(normalText, mockTerms)
    expect(result.score).toBeLessThan(normalResult.score)
  })

  it('excludes is_to_avoid terms from scoring', () => {
    const result = calculateScore('energie energie energie energie energie', mockTerms)
    const termStatuses = result.termStatuses
    const avoidTerm = termStatuses.find(t => t.term.is_to_avoid)
    // to_avoid terms still tracked but not scored
    expect(avoidTerm).toBeDefined()
  })

  it('reports correct term statuses', () => {
    const text = 'energie energie energie' // 3 < min 5
    const result = calculateScore(text, mockTerms)
    const energieStatus = result.termStatuses.find(t => t.term.term === 'energie')
    expect(energieStatus?.status).toBe('missing')
    expect(energieStatus?.count).toBe(3)
    expect(energieStatus?.delta).toBe(2) // need 2 more to reach min 5
  })
})

describe('getScoreLabel', () => {
  it('returns Mauvais for 0-30', () => {
    expect(getScoreLabel(15)).toBe('Mauvais')
  })
  it('returns Moyen for 31-55', () => {
    expect(getScoreLabel(45)).toBe('Moyen')
  })
  it('returns Bon for 56-75', () => {
    expect(getScoreLabel(65)).toBe('Bon')
  })
  it('returns Excellent for 76-100', () => {
    expect(getScoreLabel(90)).toBe('Excellent')
  })
  it('returns Sur-optimise for 101-120', () => {
    expect(getScoreLabel(110)).toBe('Sur-optimise')
  })
})

describe('getScoreColor', () => {
  it('returns red for Mauvais', () => {
    expect(getScoreColor(15)).toBe('#ef4444')
  })
  it('returns blue for Sur-optimise', () => {
    expect(getScoreColor(110)).toBe('#3b82f6')
  })
})
```

**Step 7: Run test to verify it fails**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm test
```

Expected: FAIL — module not found

**Step 8: Implement scoring engine**

`apps/web/src/lib/scoring.ts`:
```typescript
import type { SemanticTerm, TermStatus, ScoreLabel, ScoreResult, StructuralMetrics } from '@/types/database'
import { normalizeText, countOccurrences } from './text-utils'

export function calculateScore(rawText: string, terms: SemanticTerm[]): ScoreResult {
  const text = normalizeText(rawText)

  const scorableTerms = terms.filter(t => !t.is_to_avoid)
  const avoidTerms = terms.filter(t => t.is_to_avoid)

  let totalWeightedScore = 0
  let totalImportance = 0

  const termStatuses: TermStatus[] = []

  // Score scorable terms
  for (const term of scorableTerms) {
    const count = countOccurrences(text, term.term)
    let termScore: number

    if (count < term.min_occurrences) {
      // Below range: partial score proportional to progress
      termScore = term.min_occurrences === 0 ? 1.0 : (count / term.min_occurrences)
    } else if (count <= term.max_occurrences) {
      // In range: full score
      termScore = 1.0
    } else {
      // Above range: penalty
      const excess = count - term.max_occurrences
      termScore = Math.max(0.3, 1.0 - excess * 0.1)
    }

    totalWeightedScore += termScore * term.importance
    totalImportance += term.importance

    let status: 'ok' | 'missing' | 'excess'
    let delta: number

    if (count < term.min_occurrences) {
      status = 'missing'
      delta = term.min_occurrences - count
    } else if (count > term.max_occurrences) {
      status = 'excess'
      delta = term.max_occurrences - count // negative
    } else {
      status = 'ok'
      delta = 0
    }

    termStatuses.push({ term, count, status, delta })
  }

  // Track avoid terms (not scored)
  for (const term of avoidTerms) {
    const count = countOccurrences(text, term.term)
    termStatuses.push({
      term,
      count,
      status: count > 0 ? 'excess' : 'ok',
      delta: count > 0 ? -count : 0,
    })
  }

  const rawScore = totalImportance > 0
    ? (totalWeightedScore / totalImportance) * 120
    : 0
  const score = Math.min(120, Math.round(rawScore))

  return {
    score,
    label: getScoreLabel(score),
    color: getScoreColor(score),
    termStatuses,
    structuralMetrics: { words: 0, headings: 0, paragraphs: 0, links: 0, images: 0, videos: 0, tables: 0, lists: 0 },
  }
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score <= 30) return 'Mauvais'
  if (score <= 55) return 'Moyen'
  if (score <= 75) return 'Bon'
  if (score <= 100) return 'Excellent'
  return 'Sur-optimise'
}

export function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'  // red
  if (score <= 55) return '#f97316'  // orange
  if (score <= 75) return '#eab308'  // yellow
  if (score <= 100) return '#22c55e' // green
  return '#3b82f6'                   // blue
}

/**
 * Calculate structural metrics from TipTap JSON content
 */
export function calculateStructuralMetrics(content: Record<string, unknown>): StructuralMetrics {
  const metrics: StructuralMetrics = {
    words: 0, headings: 0, paragraphs: 0, links: 0,
    images: 0, videos: 0, tables: 0, lists: 0,
  }

  function traverse(node: Record<string, unknown>) {
    const type = node.type as string | undefined
    if (!type) return

    switch (type) {
      case 'heading': metrics.headings++; break
      case 'paragraph': metrics.paragraphs++; break
      case 'bulletList':
      case 'orderedList': metrics.lists++; break
      case 'table': metrics.tables++; break
      case 'image': metrics.images++; break
      case 'youtube':
      case 'video': metrics.videos++; break
      case 'text':
        if (typeof node.text === 'string') {
          metrics.words += node.text.trim().split(/\s+/).filter(Boolean).length
        }
        break
    }

    // Check marks for links
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if ((mark as Record<string, unknown>).type === 'link') metrics.links++
      }
    }

    // Recurse into children
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child as Record<string, unknown>)
      }
    }
  }

  traverse(content)
  return metrics
}
```

**Step 9: Run tests to verify they pass**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm test
```

Expected: all tests PASS

**Step 10: Commit**

```bash
git add apps/web/src/lib/ apps/web/vitest.config.ts apps/web/package.json
git commit -m "feat: implement client-side scoring engine with text normalization and tests"
```

---

## Task 5: Zustand stores — editor and guide state management

**Files:**
- Create: `apps/web/src/stores/editor-store.ts`
- Create: `apps/web/src/stores/guide-store.ts`

**Step 1: Install Zustand**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add zustand
```

**Step 2: Create editor store**

`apps/web/src/stores/editor-store.ts`:
```typescript
import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'

interface EditorState {
  content: JSONContent
  plainText: string
  setContent: (content: JSONContent) => void
  setPlainText: (text: string) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  content: {},
  plainText: '',
  setContent: (content) => set({ content }),
  setPlainText: (plainText) => set({ plainText }),
}))
```

**Step 3: Create guide store**

`apps/web/src/stores/guide-store.ts`:
```typescript
import { create } from 'zustand'
import type { Guide, SerpAnalysis, SerpPage, SemanticTerm, TermStatus, ScoreLabel, StructuralMetrics, StructuralBenchmarks } from '@/types/database'
import { calculateScore, calculateStructuralMetrics, getScoreLabel, getScoreColor } from '@/lib/scoring'

type TermFilter = 'all' | 'missing' | 'excess'

interface GuideState {
  // Data
  guide: Guide | null
  serpAnalysis: SerpAnalysis | null
  serpPages: SerpPage[]
  semanticTerms: SemanticTerm[]

  // Computed (from scoring)
  score: number
  scoreLabel: ScoreLabel
  scoreColor: string
  termStatuses: TermStatus[]
  structuralMetrics: StructuralMetrics

  // UI state
  activeTab: string
  termFilter: TermFilter

  // Actions
  setGuide: (guide: Guide) => void
  setSerpData: (analysis: SerpAnalysis, pages: SerpPage[], terms: SemanticTerm[]) => void
  recalculateScore: (plainText: string, content: Record<string, unknown>) => void
  setActiveTab: (tab: string) => void
  setTermFilter: (filter: TermFilter) => void
}

export const useGuideStore = create<GuideState>()((set, get) => ({
  guide: null,
  serpAnalysis: null,
  serpPages: [],
  semanticTerms: [],

  score: 0,
  scoreLabel: 'Mauvais',
  scoreColor: '#ef4444',
  termStatuses: [],
  structuralMetrics: { words: 0, headings: 0, paragraphs: 0, links: 0, images: 0, videos: 0, tables: 0, lists: 0 },

  activeTab: 'optimization',
  termFilter: 'all',

  setGuide: (guide) => set({ guide }),

  setSerpData: (analysis, pages, terms) => set({
    serpAnalysis: analysis,
    serpPages: pages,
    semanticTerms: terms,
  }),

  recalculateScore: (plainText, content) => {
    const { semanticTerms } = get()
    if (semanticTerms.length === 0) return

    const result = calculateScore(plainText, semanticTerms)
    const structuralMetrics = calculateStructuralMetrics(content)

    set({
      score: result.score,
      scoreLabel: result.label,
      scoreColor: result.color,
      termStatuses: result.termStatuses,
      structuralMetrics,
    })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setTermFilter: (filter) => set({ termFilter: filter }),
}))
```

**Step 4: Commit**

```bash
git add apps/web/src/stores/
git commit -m "feat: add Zustand stores for editor state and guide/scoring state"
```

---

## Task 6: TipTap editor component

**Files:**
- Create: `apps/web/src/components/editor/tiptap-editor.tsx`
- Create: `apps/web/src/components/editor/toolbar.tsx`

**Step 1: Install TipTap and extensions**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell @tiptap/extension-placeholder
```

**Step 2: Create toolbar component**

`apps/web/src/components/editor/toolbar.tsx`:
```tsx
'use client'

import { type Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Table, ImageIcon, Link, AlignLeft, AlignCenter,
  AlignRight, Undo, Redo, Highlighter, Type,
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  const iconSize = 16

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b p-2 bg-white sticky top-0 z-10">
      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      {([1, 2, 3, 4] as const).map((level) => {
        const Icon = [Heading1, Heading2, Heading3, Heading4][level - 1]
        return (
          <Button
            key={level}
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            className={editor.isActive('heading', { level }) ? 'bg-muted' : ''}
          >
            <Icon size={iconSize} />
          </Button>
        )
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive('paragraph') ? 'bg-muted' : ''}
      >
        <Type size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Formatting */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-muted' : ''}>
        <Bold size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-muted' : ''}>
        <Italic size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'bg-muted' : ''}>
        <Underline size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'bg-muted' : ''}>
        <Highlighter size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}>
        <AlignLeft size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}>
        <AlignCenter size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}>
        <AlignRight size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'bg-muted' : ''}>
        <List size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'bg-muted' : ''}>
        <ListOrdered size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Table */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table size={iconSize} />
      </Button>

      {/* Image */}
      <Button variant="ghost" size="sm" onClick={() => {
        const url = window.prompt('URL de l\'image')
        if (url) editor.chain().focus().setImage({ src: url }).run()
      }}>
        <ImageIcon size={iconSize} />
      </Button>

      {/* Link */}
      <Button variant="ghost" size="sm" onClick={() => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
        } else {
          const url = window.prompt('URL du lien')
          if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
      }} className={editor.isActive('link') ? 'bg-muted' : ''}>
        <Link size={iconSize} />
      </Button>
    </div>
  )
}
```

**Step 3: Create TipTap editor component**

`apps/web/src/components/editor/tiptap-editor.tsx`:
```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useRef } from 'react'
import { Toolbar } from './toolbar'
import { useEditorStore } from '@/stores/editor-store'
import { useGuideStore } from '@/stores/guide-store'

export function TiptapEditor() {
  const setContent = useEditorStore((s) => s.setContent)
  const setPlainText = useEditorStore((s) => s.setPlainText)
  const recalculateScore = useGuideStore((s) => s.recalculateScore)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color.configure({ types: [TextStyle.name] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Commencez a rediger votre contenu ici...' }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const text = editor.getText()

      setContent(json)
      setPlainText(text)

      // Debounce scoring recalculation
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        recalculateScore(text, json as Record<string, unknown>)
      }, 500)
    },
  })

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto p-6">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none min-h-full focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[500px]"
        />
      </div>
    </div>
  )
}
```

**Step 4: Install lucide-react (icons)**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add lucide-react
```

**Step 5: Verify build compiles**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm build
```

Expected: Build succeeds (even though editor isn't mounted on a page yet)

**Step 6: Commit**

```bash
git add apps/web/src/components/editor/
git commit -m "feat: add TipTap editor with full toolbar (headings, formatting, tables, images, links)"
```

---

## Task 7: Analysis panel — Optimization tab UI

**Files:**
- Create: `apps/web/src/components/analysis/analysis-panel.tsx`
- Create: `apps/web/src/components/analysis/score-display.tsx`
- Create: `apps/web/src/components/analysis/structural-metrics.tsx`
- Create: `apps/web/src/components/analysis/semantic-terms-list.tsx`
- Create: `apps/web/src/components/analysis/avoid-terms-list.tsx`
- Create: `apps/web/src/components/analysis/serp-benchmark.tsx`

**Step 1: Create score display component**

`apps/web/src/components/analysis/score-display.tsx`:
```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Progress } from '@/components/ui/progress'

export function ScoreDisplay() {
  const score = useGuideStore((s) => s.score)
  const label = useGuideStore((s) => s.scoreLabel)
  const color = useGuideStore((s) => s.scoreColor)

  const percentage = Math.round((score / 120) * 100)

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-sm text-muted-foreground">/120</span>
        </div>
        <span className="text-sm font-medium px-2 py-1 rounded" style={{ backgroundColor: color + '20', color }}>
          {label}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      {score > 100 && (
        <p className="text-sm text-blue-600 mt-2 font-medium">
          Attention : sur-optimisation detectee. Essayez de ne pas depasser 100.
        </p>
      )}
      {score > 0 && score <= 100 && (
        <p className="text-sm text-muted-foreground mt-2">
          Meilleur que {Math.round((score / 120) * 100)}% des pages de la 1ere page Google
        </p>
      )}
    </div>
  )
}
```

**Step 2: Create structural metrics component**

`apps/web/src/components/analysis/structural-metrics.tsx`:
```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

const METRIC_LABELS: Record<string, string> = {
  words: 'Mots',
  headings: 'Titres',
  paragraphs: 'Paragraphes',
  links: 'Liens',
  images: 'Images',
  videos: 'Videos',
  tables: 'Tableaux',
  lists: 'Listes',
}

export function StructuralMetrics() {
  const metrics = useGuideStore((s) => s.structuralMetrics)
  const benchmarks = useGuideStore((s) => s.serpAnalysis?.structural_benchmarks)

  if (!benchmarks) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir les metriques.</p>
  }

  const entries = Object.entries(METRIC_LABELS) as [keyof typeof METRIC_LABELS, string][]

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Metriques structurelles</h3>
      <div className="divide-y">
        {entries.map(([key, label]) => {
          const value = metrics[key as keyof typeof metrics]
          const bench = benchmarks[key as keyof typeof benchmarks]
          if (!bench) return null

          let status: 'ok' | 'missing' | 'excess' = 'ok'
          let message = ''

          if (value < bench.min) {
            status = 'missing'
            message = `Ajoutez au moins ${bench.min - value} ${label.toLowerCase()}.`
          } else if (value > bench.max) {
            status = 'excess'
            message = `Retirez au moins ${value - bench.max} ${label.toLowerCase()}.`
          }

          return (
            <div key={key} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">{value}</span>
                <span className="text-muted-foreground text-xs">({bench.min}-{bench.max})</span>
                <Badge variant={status === 'ok' ? 'default' : 'destructive'} className="text-xs">
                  {status === 'ok' ? 'OK' : status === 'missing' ? `+${bench.min - value}` : `-${value - bench.max}`}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Create semantic terms list component**

`apps/web/src/components/analysis/semantic-terms-list.tsx`:
```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function SemanticTermsList() {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const filter = useGuideStore((s) => s.termFilter)
  const setFilter = useGuideStore((s) => s.setTermFilter)

  const scorableTerms = termStatuses.filter(ts => !ts.term.is_to_avoid)

  const filtered = scorableTerms.filter(ts => {
    if (filter === 'missing') return ts.status === 'missing'
    if (filter === 'excess') return ts.status === 'excess'
    return true
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-4 pt-3">
        <h3 className="text-sm font-semibold flex-1">Expressions semantiques</h3>
      </div>

      <div className="flex gap-1 px-4">
        {(['all', 'missing', 'excess'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {f === 'all' ? 'Toutes' : f === 'missing' ? 'A ajouter' : 'A supprimer'}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-1 px-4 pb-4">
          {filtered.map((ts) => (
            <div
              key={ts.term.id}
              className={`flex items-center justify-between p-2 rounded text-sm ${
                ts.term.is_main_keyword ? 'border-2 border-gray-900' : 'border'
              }`}
            >
              <div className="flex-1">
                <span className={ts.term.is_main_keyword ? 'font-bold' : ''}>
                  {ts.term.display_term}
                </span>
                {ts.term.is_main_keyword && (
                  <Badge variant="secondary" className="ml-2 text-xs">MOT-CLE</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">
                  {ts.count}/{ts.term.min_occurrences}-{ts.term.max_occurrences}
                </span>
                <Badge
                  variant={ts.status === 'ok' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {ts.status === 'ok'
                    ? 'OK'
                    : ts.status === 'missing'
                      ? `+${ts.delta}`
                      : `${ts.delta}`}
                </Badge>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune expression a afficher.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Step 4: Create avoid terms list**

`apps/web/src/components/analysis/avoid-terms-list.tsx`:
```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

export function AvoidTermsList() {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const avoidTerms = termStatuses.filter(ts => ts.term.is_to_avoid)

  if (avoidTerms.length === 0) return null

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Expressions a eviter</h3>
      <div className="space-y-1 px-4 pb-2">
        {avoidTerms.map((ts) => (
          <div key={ts.term.id} className="flex items-center justify-between p-2 border rounded text-sm">
            <span>{ts.term.display_term}</span>
            <div className="flex items-center gap-2">
              {ts.count > 0 ? (
                <>
                  <span className="text-xs text-muted-foreground">{ts.count} occurrence(s)</span>
                  <Badge variant="destructive" className="text-xs">Supprimer</Badge>
                </>
              ) : (
                <Badge variant="default" className="text-xs">Bien !</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 5: Create SERP benchmark component**

`apps/web/src/components/analysis/serp-benchmark.tsx`:
```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

export function SerpBenchmark() {
  const pages = useGuideStore((s) => s.serpPages)

  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir le benchmark.</p>
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Benchmark SERP</h3>
      <div className="space-y-1 px-4 pb-4">
        {pages
          .sort((a, b) => a.position - b.position)
          .map((page) => (
            <div key={page.id} className={`p-3 border rounded text-sm ${page.is_excluded ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium truncate flex-1 mr-2">{page.title}</span>
                <span className="font-bold text-lg">{page.score}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mb-1">{page.url}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{page.metrics.words} mots</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.headings} titres</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.links} liens</Badge>
                <Badge variant="outline" className="text-xs">{page.metrics.images} images</Badge>
              </div>
              {page.is_excluded && (
                <p className="text-xs text-muted-foreground mt-1 italic">Resultat non pris en compte</p>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
```

**Step 6: Create the main analysis panel**

`apps/web/src/components/analysis/analysis-panel.tsx`:
```tsx
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGuideStore } from '@/stores/guide-store'
import { ScoreDisplay } from './score-display'
import { StructuralMetrics } from './structural-metrics'
import { SemanticTermsList } from './semantic-terms-list'
import { AvoidTermsList } from './avoid-terms-list'
import { SerpBenchmark } from './serp-benchmark'

export function AnalysisPanel() {
  const activeTab = useGuideStore((s) => s.activeTab)
  const setActiveTab = useGuideStore((s) => s.setActiveTab)

  return (
    <div className="h-full flex flex-col border-l">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="grid grid-cols-7 mx-2 mt-2">
          <TabsTrigger value="assistant" disabled className="text-xs">🤖</TabsTrigger>
          <TabsTrigger value="plan" disabled className="text-xs">📑</TabsTrigger>
          <TabsTrigger value="intention" disabled className="text-xs">🎯</TabsTrigger>
          <TabsTrigger value="optimization" className="text-xs">🔍</TabsTrigger>
          <TabsTrigger value="links" disabled className="text-xs">🔗</TabsTrigger>
          <TabsTrigger value="meta" disabled className="text-xs">🧐</TabsTrigger>
          <TabsTrigger value="config" disabled className="text-xs">🔧</TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <ScoreDisplay />
              <StructuralMetrics />
              <SemanticTermsList />
              <AvoidTermsList />
              <SerpBenchmark />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Placeholder tabs */}
        {['assistant', 'plan', 'intention', 'links', 'meta', 'config'].map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Module a venir</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
```

**Step 7: Commit**

```bash
git add apps/web/src/components/analysis/
git commit -m "feat: add analysis panel with score display, structural metrics, semantic terms, benchmark"
```

---

## Task 8: Main editor page — split layout

**Files:**
- Create: `apps/web/src/app/(editor)/guide/[id]/page.tsx`
- Create: `apps/web/src/app/(editor)/layout.tsx`
- Modify: `apps/web/src/app/layout.tsx` (verify root layout)
- Modify: `apps/web/src/app/page.tsx` (temporary redirect)

**Step 1: Install react-resizable-panels**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add react-resizable-panels
```

**Step 2: Create editor layout**

`apps/web/src/app/(editor)/layout.tsx`:
```tsx
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      {children}
    </div>
  )
}
```

**Step 3: Create the main guide editor page**

`apps/web/src/app/(editor)/guide/[id]/page.tsx`:
```tsx
'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'react-resizable-panels' // Note: this is the correct import
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { AnalysisPanel } from '@/components/analysis/analysis-panel'
import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'

// Note: react-resizable-panels uses PanelGroup, Panel, PanelResizeHandle
// If the package exports differ, adjust imports accordingly.
// Alternative: import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

export default function GuideEditorPage() {
  const score = useGuideStore((s) => s.score)
  const scoreColor = useGuideStore((s) => s.scoreColor)
  const scoreLabel = useGuideStore((s) => s.scoreLabel)
  const guide = useGuideStore((s) => s.guide)

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg">SERPmantics</h1>
          {guide && (
            <Badge variant="outline" className="text-sm">
              {guide.keyword}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score}</span>
          <span className="text-sm text-muted-foreground">/120</span>
          <Badge style={{ backgroundColor: scoreColor + '20', color: scoreColor }}>
            {scoreLabel}
          </Badge>
        </div>
      </header>

      {/* Split panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={30}>
          <TiptapEditor />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={25}>
          <AnalysisPanel />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Score bar footer */}
      <div className="h-1.5" style={{ backgroundColor: scoreColor }} />
    </div>
  )
}
```

**NOTE:** Verify the exact export names from `react-resizable-panels`. The package exports `Panel`, `PanelGroup`, `PanelResizeHandle`. If shadcn wraps these as `ResizablePanel` etc., use those. Check `apps/web/src/components/ui/resizable.tsx` if it exists after shadcn init.

**Step 4: If `resizable.tsx` doesn't exist in shadcn, install it**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm dlx shadcn@latest add resizable
```

Then update the imports in the page to use `@/components/ui/resizable` instead of importing directly from `react-resizable-panels`.

**Step 5: Update homepage to redirect to a test guide**

`apps/web/src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  // Temporary: redirect to a test guide editor
  redirect('/guide/test')
}
```

**Step 6: Verify dev server renders the editor**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic"
pnpm dev
```

Visit http://localhost:3000/guide/test — should see split panes with TipTap editor on left and analysis panel on right.

**Step 7: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: add main editor page with resizable split layout"
```

---

## Task 9: Python NLP micro-service

**Files:**
- Create: `services/nlp/requirements.txt`
- Create: `services/nlp/main.py`
- Create: `services/nlp/pipeline.py`
- Create: `services/nlp/languages.py`
- Create: `services/nlp/tests/test_pipeline.py`

**Step 1: Create requirements.txt**

`services/nlp/requirements.txt`:
```
fastapi==0.115.0
uvicorn==0.30.0
spacy==3.8.0
scikit-learn==1.5.0
pydantic==2.9.0
pytest==8.3.0
httpx==0.27.0
```

**Step 2: Create Python virtual env and install deps**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/services/nlp"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download fr_core_news_md
python -m spacy download en_core_web_md
```

Note: For MVP, start with French (fr) and English (en). Other language models (it, de, es) can be added later.

**Step 3: Create language config**

`services/nlp/languages.py`:
```python
SPACY_MODELS = {
    "fr": "fr_core_news_md",
    "en": "en_core_web_md",
}

def get_model_name(language: str) -> str:
    return SPACY_MODELS.get(language, "en_core_web_md")
```

**Step 4: Create NLP pipeline**

`services/nlp/pipeline.py`:
```python
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import Counter
import numpy as np
from languages import get_model_name

# Cache loaded models
_models: dict[str, spacy.Language] = {}


def get_nlp(language: str) -> spacy.Language:
    if language not in _models:
        model_name = get_model_name(language)
        _models[language] = spacy.load(model_name)
    return _models[language]


def lemmatize_text(text: str, language: str) -> list[str]:
    """Tokenize + lemmatize + remove stopwords and punctuation."""
    nlp = get_nlp(language)
    doc = nlp(text)
    return [
        token.lemma_.lower()
        for token in doc
        if not token.is_stop and not token.is_punct and not token.is_space and len(token.lemma_) > 1
    ]


def extract_ngrams(tokens: list[str], n: int) -> list[str]:
    """Extract n-grams from a list of tokens."""
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def analyze_corpus(texts: list[str], language: str) -> dict:
    """
    Analyze a corpus of SERP page texts.
    Returns semantic terms with occurrence ranges and terms to avoid.
    """
    nlp = get_nlp(language)

    # Lemmatize all texts
    lemmatized_texts = []
    all_tokens_per_doc = []
    for text in texts:
        tokens = lemmatize_text(text, language)
        lemmatized_texts.append(" ".join(tokens))
        all_tokens_per_doc.append(tokens)

    # TF-IDF to find significant terms
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=200,
        min_df=2,  # term must appear in at least 2 docs
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(lemmatized_texts)
    except ValueError:
        # Not enough documents
        return {"terms": [], "terms_to_avoid": []}

    feature_names = vectorizer.get_feature_names_out()
    mean_tfidf = np.array(tfidf_matrix.mean(axis=0)).flatten()

    # Select significant terms (above median TF-IDF)
    threshold = np.median(mean_tfidf[mean_tfidf > 0])
    significant_indices = np.where(mean_tfidf > threshold)[0]

    terms = []
    for idx in significant_indices:
        term = feature_names[idx]
        tfidf_score = float(mean_tfidf[idx])

        # Count occurrences in each document
        occurrences = []
        for tokens in all_tokens_per_doc:
            doc_text = " ".join(tokens)
            count = doc_text.count(term)
            occurrences.append(count)

        occurrences_arr = np.array(occurrences)
        p10 = int(np.percentile(occurrences_arr, 10))
        p90 = int(np.percentile(occurrences_arr, 90))

        # Determine term type
        word_count = len(term.split())
        if word_count == 1:
            term_type = "unigram"
        elif word_count == 2:
            term_type = "bigram"
        elif word_count == 3:
            term_type = "trigram"
        else:
            term_type = "phrase"

        terms.append({
            "term": term,
            "display_term": term,
            "min_occurrences": max(0, p10),
            "max_occurrences": max(p10, p90),
            "importance": round(tfidf_score * 10, 2),
            "term_type": term_type,
        })

    # Sort by importance descending
    terms.sort(key=lambda t: t["importance"], reverse=True)

    # Terms to avoid: high raw frequency but low TF-IDF
    low_tfidf_indices = np.where(
        (mean_tfidf > 0) & (mean_tfidf <= threshold)
    )[0]

    terms_to_avoid = []
    for idx in low_tfidf_indices:
        term = feature_names[idx]
        # Only single words as avoid terms
        if len(term.split()) == 1:
            raw_freq = sum(
                " ".join(tokens).count(term) for tokens in all_tokens_per_doc
            )
            if raw_freq > len(texts) * 2:  # appears frequently but low TF-IDF
                terms_to_avoid.append(term)

    return {
        "terms": terms[:100],  # Cap at 100 terms
        "terms_to_avoid": terms_to_avoid[:20],  # Cap at 20
    }
```

**Step 5: Create FastAPI server**

`services/nlp/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pipeline import analyze_corpus

app = FastAPI(title="SERPmantics NLP Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    texts: list[str]
    language: str = "fr"


class HealthResponse(BaseModel):
    status: str


@app.get("/health", response_model=HealthResponse)
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    result = analyze_corpus(req.texts, req.language)
    return result
```

**Step 6: Write tests for NLP pipeline**

`services/nlp/tests/test_pipeline.py`:
```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import lemmatize_text, analyze_corpus


def test_lemmatize_french():
    tokens = lemmatize_text("Les énergies renouvelables sont importantes", "fr")
    assert "energie" in tokens or "renouvelable" in tokens
    assert "les" not in tokens  # stopword removed


def test_analyze_corpus_returns_terms():
    texts = [
        "L'énergie solaire est une source d'énergie renouvelable très importante pour la transition énergétique.",
        "Les panneaux solaires permettent de capter l'énergie du soleil pour produire de l'énergie électrique.",
        "La transition énergétique passe par le développement de l'énergie solaire et éolienne.",
    ]
    result = analyze_corpus(texts, "fr")
    assert "terms" in result
    assert "terms_to_avoid" in result
    assert len(result["terms"]) > 0

    # Check term structure
    first_term = result["terms"][0]
    assert "term" in first_term
    assert "min_occurrences" in first_term
    assert "max_occurrences" in first_term
    assert "importance" in first_term
    assert "term_type" in first_term


def test_analyze_corpus_empty():
    result = analyze_corpus([], "fr")
    assert result["terms"] == []
```

**Step 7: Run NLP tests**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/services/nlp"
source .venv/bin/activate
python -m pytest tests/ -v
```

Expected: all tests PASS

**Step 8: Start NLP server and verify health endpoint**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/services/nlp"
source .venv/bin/activate
uvicorn main:app --port 8000 &
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

Kill the background server after verification.

**Step 9: Commit**

```bash
git add services/nlp/
git commit -m "feat: add Python FastAPI NLP micro-service with spaCy lemmatization and TF-IDF"
```

---

## Task 10: SERP analysis API route — crawl + NLP pipeline

**Files:**
- Create: `apps/web/src/app/api/serp/analyze/route.ts`
- Create: `apps/web/src/lib/serp.ts`
- Create: `apps/web/src/lib/crawler.ts`

**Step 1: Install dependencies**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm add cheerio serpapi
```

**Step 2: Add env vars**

Add to `apps/web/.env.local`:
```
SERPAPI_KEY=<user's SerpApi key>
NLP_SERVICE_URL=http://localhost:8000
```

**Step 3: Create SerpApi client**

`apps/web/src/lib/serp.ts`:
```typescript
import { getJson } from 'serpapi'

export interface SerpResult {
  position: number
  title: string
  link: string
  snippet: string
}

const EXCLUDED_DOMAINS = [
  'wikipedia.org', 'youtube.com', 'facebook.com', 'twitter.com',
  'instagram.com', 'linkedin.com', 'tiktok.com', 'pinterest.com',
]

export async function fetchSerpResults(keyword: string, language: string, searchEngine: string): Promise<SerpResult[]> {
  const params: Record<string, string> = {
    q: keyword,
    api_key: process.env.SERPAPI_KEY!,
    num: '10',
  }

  // Map language to Google domain
  if (searchEngine.includes('google.fr')) {
    params.google_domain = 'google.fr'
    params.hl = 'fr'
    params.gl = 'fr'
  } else {
    params.google_domain = 'google.com'
    params.hl = language
  }

  const data = await getJson('google', params)

  const results: SerpResult[] = (data.organic_results || [])
    .filter((r: { link: string }) => {
      const url = new URL(r.link)
      return !EXCLUDED_DOMAINS.some(d => url.hostname.includes(d))
    })
    .map((r: { position: number; title: string; link: string; snippet: string }, i: number) => ({
      position: i + 1,
      title: r.title,
      link: r.link,
      snippet: r.snippet || '',
    }))

  return results.slice(0, 10)
}
```

**Step 4: Create page crawler**

`apps/web/src/lib/crawler.ts`:
```typescript
import * as cheerio from 'cheerio'

export interface CrawledPage {
  url: string
  title: string
  text: string
  metrics: {
    words: number
    headings: number
    paragraphs: number
    links: number
    images: number
    videos: number
    tables: number
    lists: number
  }
}

export async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SERPmantics/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove non-editorial content
    $('nav, footer, header, aside, script, style, noscript, iframe, .cookie, .nav, .sidebar, .menu, .footer, .header, .ad, .advertisement').remove()

    // Extract editorial text
    const editorialSelectors = ['article', 'main', '[role="main"]', '.content', '.post-content', '.entry-content']
    let $editorial = $(editorialSelectors.join(', '))
    if ($editorial.length === 0) {
      $editorial = $('body')
    }

    const text = $editorial.text().replace(/\s+/g, ' ').trim()
    const title = $('title').text().trim() || $('h1').first().text().trim()

    // Count structural metrics on the full page body
    const $body = $('body')
    const metrics = {
      words: text.split(/\s+/).filter(Boolean).length,
      headings: $body.find('h1, h2, h3, h4, h5, h6').length,
      paragraphs: $body.find('p').length,
      links: $body.find('a[href]').length,
      images: $body.find('img').length,
      videos: $body.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      tables: $body.find('table').length,
      lists: $body.find('ul, ol').length,
    }

    return { url, title, text, metrics }
  } catch {
    return null
  }
}
```

**Step 5: Create SERP analyze API route**

`apps/web/src/app/api/serp/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchSerpResults } from '@/lib/serp'
import { crawlPage, type CrawledPage } from '@/lib/crawler'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/scoring'
import type { SemanticTerm } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const { keyword, language, searchEngine, guideId } = await request.json()

    if (!keyword || !guideId) {
      return NextResponse.json({ error: 'keyword and guideId are required' }, { status: 400 })
    }

    const lang = language || 'fr'
    const engine = searchEngine || 'google.fr'

    // 1. Fetch SERP results
    const serpResults = await fetchSerpResults(keyword, lang, engine)

    if (serpResults.length === 0) {
      return NextResponse.json({ error: 'No SERP results found' }, { status: 404 })
    }

    // 2. Crawl pages in parallel
    const crawlPromises = serpResults.map(r => crawlPage(r.link))
    const crawledPages = (await Promise.all(crawlPromises)).filter(Boolean) as CrawledPage[]

    if (crawledPages.length < 2) {
      return NextResponse.json({ error: 'Not enough pages could be crawled' }, { status: 500 })
    }

    // 3. Send texts to NLP service
    const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: crawledPages.map(p => p.text),
        language: lang,
      }),
    })

    if (!nlpResponse.ok) {
      return NextResponse.json({ error: 'NLP service error' }, { status: 500 })
    }

    const nlpData = await nlpResponse.json()

    // 4. Calculate structural benchmarks (P10-P90)
    const metricsArrays = {
      words: crawledPages.map(p => p.metrics.words),
      headings: crawledPages.map(p => p.metrics.headings),
      paragraphs: crawledPages.map(p => p.metrics.paragraphs),
      links: crawledPages.map(p => p.metrics.links),
      images: crawledPages.map(p => p.metrics.images),
      videos: crawledPages.map(p => p.metrics.videos),
      tables: crawledPages.map(p => p.metrics.tables),
      lists: crawledPages.map(p => p.metrics.lists),
    }

    const percentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b)
      const idx = Math.ceil((p / 100) * sorted.length) - 1
      return sorted[Math.max(0, idx)]
    }

    const structuralBenchmarks: Record<string, { min: number; max: number }> = {}
    for (const [key, values] of Object.entries(metricsArrays)) {
      structuralBenchmarks[key] = {
        min: percentile(values, 10),
        max: percentile(values, 90),
      }
    }

    // 5. Build semantic terms for scoring each SERP page
    const semanticTermsForScoring: SemanticTerm[] = nlpData.terms.map((t: Record<string, unknown>, i: number) => ({
      id: `temp-${i}`,
      serp_analysis_id: '',
      term: t.term as string,
      display_term: t.display_term as string,
      is_main_keyword: (t.term as string).includes(keyword.toLowerCase()),
      min_occurrences: t.min_occurrences as number,
      max_occurrences: t.max_occurrences as number,
      importance: t.importance as number,
      term_type: t.term_type as 'unigram' | 'bigram' | 'trigram' | 'phrase',
      is_to_avoid: false,
    }))

    // 6. Calculate score for each SERP page
    const serpPagesData = crawledPages.map((page, i) => {
      const result = calculateScore(page.text, semanticTermsForScoring)
      return {
        url: page.url,
        title: page.title || serpResults[i]?.title || '',
        score: result.score,
        is_excluded: false,
        metrics: page.metrics,
        term_occurrences: Object.fromEntries(
          result.termStatuses.map(ts => [ts.term.term, ts.count])
        ),
        position: i + 1,
      }
    })

    // 7. Calculate refresh interval (median page age — simplified: default 6 months)
    const refreshIntervalMonths = 6
    const refreshDate = new Date()
    refreshDate.setMonth(refreshDate.getMonth() + refreshIntervalMonths)

    // 8. Store in Supabase
    const supabase = await createClient()

    // Delete existing analysis for this guide
    await supabase.from('serp_analyses').delete().eq('guide_id', guideId)

    // Insert SERP analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('serp_analyses')
      .insert({
        guide_id: guideId,
        keyword,
        language: lang,
        structural_benchmarks: structuralBenchmarks,
        refresh_interval_months: refreshIntervalMonths,
        refresh_recommended_at: refreshDate.toISOString(),
      })
      .select()
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Failed to save analysis', detail: analysisError }, { status: 500 })
    }

    // Insert SERP pages
    const { error: pagesError } = await supabase
      .from('serp_pages')
      .insert(serpPagesData.map(p => ({ ...p, serp_analysis_id: analysis.id })))

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to save SERP pages', detail: pagesError }, { status: 500 })
    }

    // Insert semantic terms
    const termsToInsert = [
      ...nlpData.terms.map((t: Record<string, unknown>) => ({
        serp_analysis_id: analysis.id,
        term: t.term,
        display_term: t.display_term,
        is_main_keyword: (t.term as string).includes(keyword.toLowerCase()),
        min_occurrences: t.min_occurrences,
        max_occurrences: t.max_occurrences,
        importance: t.importance,
        term_type: t.term_type,
        is_to_avoid: false,
      })),
      ...nlpData.terms_to_avoid.map((term: string) => ({
        serp_analysis_id: analysis.id,
        term,
        display_term: term,
        is_main_keyword: false,
        min_occurrences: 0,
        max_occurrences: 0,
        importance: 0,
        term_type: 'unigram',
        is_to_avoid: true,
      })),
    ]

    const { error: termsError } = await supabase
      .from('semantic_terms')
      .insert(termsToInsert)

    if (termsError) {
      return NextResponse.json({ error: 'Failed to save terms', detail: termsError }, { status: 500 })
    }

    // 9. Return the complete data
    const { data: savedTerms } = await supabase
      .from('semantic_terms')
      .select()
      .eq('serp_analysis_id', analysis.id)

    const { data: savedPages } = await supabase
      .from('serp_pages')
      .select()
      .eq('serp_analysis_id', analysis.id)
      .order('position')

    return NextResponse.json({
      analysis,
      pages: savedPages,
      terms: savedTerms,
    })
  } catch (error) {
    console.error('SERP analysis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 6: Commit**

```bash
git add apps/web/src/lib/serp.ts apps/web/src/lib/crawler.ts apps/web/src/app/api/
git commit -m "feat: add SERP analysis API route with SerpApi, Cheerio crawling, NLP integration"
```

---

## Task 11: Guide CRUD API routes

**Files:**
- Create: `apps/web/src/app/api/guides/route.ts` (GET list, POST create)
- Create: `apps/web/src/app/api/guides/[id]/route.ts` (GET single, PATCH update, DELETE)

**Step 1: Create list/create route**

`apps/web/src/app/api/guides/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyword, language, searchEngine } = await request.json()

  if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('guides')
    .insert({
      user_id: user.id,
      keyword,
      language: language || 'fr',
      search_engine: searchEngine || 'google.fr',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Create single guide route**

`apps/web/src/app/api/guides/[id]/route.ts`:
```typescript
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
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "feat: add guide CRUD API routes with Supabase"
```

---

## Task 12: Wire everything together — load guide data + trigger SERP analysis

**Files:**
- Modify: `apps/web/src/app/(editor)/guide/[id]/page.tsx`

**Step 1: Add data loading and SERP analysis trigger to the guide page**

Update `apps/web/src/app/(editor)/guide/[id]/page.tsx` to:
- Load guide data on mount
- Provide a button to trigger SERP analysis
- Wire SERP data into the guide store

This involves adding `useEffect` to fetch `/api/guides/[id]` on load, and a "Analyser" button that calls `/api/serp/analyze`. The full updated code should replace the existing page content, adding the data fetching logic while keeping the existing layout.

Key additions:
```tsx
// Add at top of component:
const { id } = useParams()
const setSerpData = useGuideStore(s => s.setSerpData)
const setGuide = useGuideStore(s => s.setGuide)
const [loading, setLoading] = useState(false)

// Fetch guide on mount
useEffect(() => {
  async function loadGuide() {
    const res = await fetch(`/api/guides/${id}`)
    if (res.ok) {
      const data = await res.json()
      setGuide(data.guide)
      if (data.analysis && data.pages && data.terms) {
        setSerpData(data.analysis, data.pages, data.terms)
      }
    }
  }
  if (id && id !== 'test') loadGuide()
}, [id])

// SERP analysis handler
async function handleAnalyze() {
  if (!guide) return
  setLoading(true)
  const res = await fetch('/api/serp/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: guide.keyword,
      language: guide.language,
      searchEngine: guide.search_engine,
      guideId: guide.id,
    }),
  })
  if (res.ok) {
    const data = await res.json()
    setSerpData(data.analysis, data.pages, data.terms)
  }
  setLoading(false)
}
```

Add an "Analyser la SERP" button in the header.

**Step 2: Auto-save guide content with debounce**

Add auto-save of the editor content to Supabase via PATCH `/api/guides/[id]` with a 3-second debounce on content changes.

**Step 3: Verify the complete flow**

1. Start NLP service: `cd services/nlp && source .venv/bin/activate && uvicorn main:app --port 8000`
2. Start Next.js: `cd apps/web && pnpm dev`
3. Create a guide via API or directly in Supabase
4. Navigate to `/guide/<uuid>`
5. Click "Analyser la SERP"
6. Start typing in editor
7. Verify score updates in real time

**Step 4: Commit**

```bash
git add apps/web/src/app/(editor)/
git commit -m "feat: wire guide data loading, SERP analysis trigger, auto-save"
```

---

## Task 13: Dashboard page — guide list + create guide

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/guide-card.tsx`
- Create: `apps/web/src/components/dashboard/create-guide-dialog.tsx`
- Modify: `apps/web/src/app/page.tsx` (redirect to dashboard)

**Step 1: Create guide card component**

Small card showing: keyword, language, score, last update, link to editor.

**Step 2: Create "create guide" dialog**

Dialog with fields: keyword (required), language (select), search engine (select). On submit: POST `/api/guides`, redirect to `/guide/[new-id]`.

**Step 3: Create dashboard page**

Lists all guides, shows create button. Uses `GET /api/guides`.

**Step 4: Update homepage redirect**

```tsx
redirect('/dashboard')
```

**Step 5: Commit**

```bash
git add apps/web/src/app/ apps/web/src/components/dashboard/
git commit -m "feat: add dashboard page with guide list and create guide dialog"
```

---

## Task 14: Authentication — Supabase Auth

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`
- Create: `apps/web/src/middleware.ts`

**Step 1: Create login page**

Email + password login form using Supabase `signInWithPassword`.

**Step 2: Create register page**

Email + password + name sign-up form using Supabase `signUp`.

**Step 3: Create middleware for auth protection**

`apps/web/src/middleware.ts` — redirect unauthenticated users to /login. Protect all routes except /login and /register.

**Step 4: Verify login flow**

1. Visit `/dashboard` → redirected to `/login`
2. Register a new account
3. Login → redirected to `/dashboard`
4. Create guide → opens editor

**Step 5: Commit**

```bash
git add apps/web/src/app/(auth)/ apps/web/src/middleware.ts
git commit -m "feat: add authentication with Supabase Auth (login, register, middleware)"
```

---

## Task 15: Final integration test + polish

**Step 1: Run all tests**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm test
```

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/services/nlp"
source .venv/bin/activate
python -m pytest tests/ -v
```

**Step 2: Run Next.js build**

```bash
cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web"
pnpm build
```

**Step 3: Manual end-to-end verification**

1. Start NLP service
2. Start Next.js dev
3. Register → Login → Dashboard
4. Create guide with keyword "delegataire cee"
5. Click "Analyser la SERP" → wait for analysis
6. Start writing in editor
7. Verify: score updates, term statuses show, structural metrics display, SERP benchmark visible
8. Verify: over-optimization warning appears if score > 100

**Step 4: Fix any issues found**

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: SERPmantics MVP — complete editor + real-time semantic scoring"
```
