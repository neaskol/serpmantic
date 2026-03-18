# shadcn/ui UI/UX Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 8 missing shadcn/ui components to improve notifications, forms, loading states, navigation, actions, and data display across the app.

**Architecture:** Additive changes only — install shadcn components via CLI, then integrate into existing files. No structural refactoring. Zustand stores untouched. Theme preserved.

**Tech Stack:** shadcn/ui (base-nova style), Next.js 15, React 19, Tailwind CSS v4, Zustand, Lucide icons

**Working directory:** `apps/web/` (all commands run from here)

---

## Task 1: Install all 8 shadcn components

**Files:**
- Modified by CLI: `src/components/ui/` (8 new files)
- Modified by CLI: `package.json` (new deps)

**Step 1: Install components via shadcn CLI**

Run from `apps/web/`:
```bash
npx shadcn@latest add sonner select alert-dialog skeleton dropdown-menu breadcrumb table popover
```

Expected: 8 new files created in `src/components/ui/`, dependencies auto-installed.

**Step 2: Verify installation**

Run: `ls src/components/ui/`
Expected: Should now contain ~20 files (12 existing + 8 new).

**Step 3: Commit**

```bash
git add src/components/ui/ package.json pnpm-lock.yaml
git commit -m "feat: install 8 shadcn/ui components (sonner, select, alert-dialog, skeleton, dropdown-menu, breadcrumb, table, popover)"
```

---

## Task 2: Add Sonner toast notifications

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/(editor)/guide/[id]/page.tsx`

**Step 1: Add Toaster to root layout**

In `src/app/layout.tsx`, add the Sonner Toaster provider:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SERPmantics",
  description: "Outil SaaS de rédaction et d'optimisation sémantique SEO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans", geist.variable)}>
      <body className={GeistSans.className}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
```

**Step 2: Add toast notifications to guide editor page**

In `src/app/(editor)/guide/[id]/page.tsx`, add toast calls:

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { AnalysisPanel } from '@/components/analysis/analysis-panel'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function GuideEditorPage() {
  const { id } = useParams()
  const score = useGuideStore((s) => s.score)
  const scoreColor = useGuideStore((s) => s.scoreColor)
  const scoreLabel = useGuideStore((s) => s.scoreLabel)
  const guide = useGuideStore((s) => s.guide)
  const setGuide = useGuideStore((s) => s.setGuide)
  const setSerpData = useGuideStore((s) => s.setSerpData)
  const content = useEditorStore((s) => s.content)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      } else {
        toast.error('Impossible de charger le guide')
      }
    }
    if (id && id !== 'test') {
      setLoading(true)
      loadGuide().finally(() => setLoading(false))
    }
  }, [id, setGuide, setSerpData])

  // Auto-save content with debounce
  useEffect(() => {
    if (!guide || !content || Object.keys(content).length === 0) return

    if (saveRef.current) clearTimeout(saveRef.current)
    saveRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/guides/${guide.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, score }),
        })
        if (res.ok) {
          toast.success('Guide sauvegarde', { duration: 2000 })
        } else {
          toast.error('Erreur lors de la sauvegarde')
        }
      } catch {
        toast.error('Erreur reseau lors de la sauvegarde')
      }
    }, 3000)

    return () => {
      if (saveRef.current) clearTimeout(saveRef.current)
    }
  }, [content, guide, score])

  // SERP analysis handler
  async function handleAnalyze() {
    if (!guide) return
    setAnalyzing(true)
    toast.promise(
      (async () => {
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
        if (!res.ok) throw new Error('Analyse echouee')
        const data = await res.json()
        setSerpData(data.analysis, data.pages, data.terms)
        return data
      })().finally(() => setAnalyzing(false)),
      {
        loading: 'Analyse SERP en cours...',
        success: 'Analyse terminee !',
        error: 'Erreur lors de l\'analyse SERP',
      }
    )
  }

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
          {guide && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? 'Analyse en cours...' : 'Analyser la SERP'}
            </Button>
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
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={30}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Chargement...</div>
          ) : (
            <TiptapEditor />
          )}
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

**Step 3: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds without errors.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/\(editor\)/guide/\[id\]/page.tsx
git commit -m "feat: add sonner toast notifications for save and SERP analysis"
```

---

## Task 3: Replace native select with shadcn Select

**Files:**
- Modify: `src/components/dashboard/create-guide-dialog.tsx`

**Step 1: Replace the native `<select>` with shadcn Select**

Replace the full file content of `src/components/dashboard/create-guide-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Espanol' },
  { value: 'it', label: 'Italiano' },
]

export function CreateGuideDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [language, setLanguage] = useState('fr')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!keyword.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          language,
          searchEngine: language === 'fr' ? 'google.fr' : 'google.com',
        }),
      })

      if (res.ok) {
        const guide = await res.json()
        toast.success('Guide cree avec succes')
        setOpen(false)
        router.push(`/guide/${guide.id}`)
      } else {
        toast.error('Erreur lors de la creation du guide')
      }
    } catch {
      toast.error('Erreur reseau')
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        Nouveau guide
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Creer un nouveau guide</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot-cle cible</label>
            <Input
              placeholder="Ex: delegataire cee"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Langue</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une langue" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={loading || !keyword.trim()} className="w-full">
            {loading ? 'Creation...' : 'Creer le guide'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/dashboard/create-guide-dialog.tsx
git commit -m "feat: replace native select with shadcn Select in create guide dialog"
```

---

## Task 4: Add Skeleton loading states

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/components/analysis/score-display.tsx`
- Modify: `src/components/analysis/structural-metrics.tsx`
- Modify: `src/components/analysis/semantic-terms-list.tsx`

**Step 1: Add skeleton loading to dashboard**

Replace the full file content of `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { GuideCard } from '@/components/dashboard/guide-card'
import { CreateGuideDialog } from '@/components/dashboard/create-guide-dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface Guide {
  id: string
  keyword: string
  language: string
  score: number
  updated_at: string
}

function GuideCardSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export default function DashboardPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadGuides() {
      const res = await fetch('/api/guides')
      if (res.ok) {
        const data = await res.json()
        setGuides(data)
      }
      setLoading(false)
    }
    loadGuides()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Mes guides</h1>
          <p className="text-muted-foreground">Gerez vos guides d&apos;optimisation semantique</p>
        </div>
        <CreateGuideDialog />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GuideCardSkeleton />
          <GuideCardSkeleton />
          <GuideCardSkeleton />
        </div>
      ) : guides.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Vous n&apos;avez pas encore de guide.</p>
          <CreateGuideDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add skeleton loading to score display**

Replace the full file content of `src/components/analysis/score-display.tsx`:

```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export function ScoreDisplay({ loading = false }: { loading?: boolean }) {
  const score = useGuideStore((s) => s.score)
  const label = useGuideStore((s) => s.scoreLabel)
  const color = useGuideStore((s) => s.scoreColor)
  const hasAnalysis = useGuideStore((s) => !!s.serpAnalysis)

  if (loading) {
    return (
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }

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
      {score > 0 && score <= 100 && hasAnalysis && (
        <p className="text-sm text-muted-foreground mt-2">
          Meilleur que {Math.round((score / 120) * 100)}% des pages de la 1ere page Google
        </p>
      )}
    </div>
  )
}
```

**Step 3: Add skeleton loading to structural metrics**

Replace the full file content of `src/components/analysis/structural-metrics.tsx`:

```tsx
'use client'

import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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

function MetricSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
    </div>
  )
}

export function StructuralMetrics({ loading = false }: { loading?: boolean }) {
  const metrics = useGuideStore((s) => s.structuralMetrics)
  const benchmarks = useGuideStore((s) => s.serpAnalysis?.structural_benchmarks)

  if (loading) {
    return (
      <div className="space-y-1">
        <div className="px-4 pt-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

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

          if (value < bench.min) {
            status = 'missing'
          } else if (value > bench.max) {
            status = 'excess'
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

**Step 4: Add skeleton and search to semantic terms list**

Replace the full file content of `src/components/analysis/semantic-terms-list.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

function TermSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
    </div>
  )
}

export function SemanticTermsList({ loading = false }: { loading?: boolean }) {
  const termStatuses = useGuideStore((s) => s.termStatuses)
  const filter = useGuideStore((s) => s.termFilter)
  const setFilter = useGuideStore((s) => s.setTermFilter)
  const [search, setSearch] = useState('')

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="px-4 pt-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-1 px-4">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <div className="space-y-1 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TermSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const scorableTerms = termStatuses.filter(ts => !ts.term.is_to_avoid)

  const filtered = scorableTerms.filter(ts => {
    if (filter === 'missing') return ts.status === 'missing'
    if (filter === 'excess') return ts.status === 'excess'
    return true
  }).filter(ts => {
    if (!search.trim()) return true
    return ts.term.display_term.toLowerCase().includes(search.toLowerCase())
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

      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un terme..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
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

**Step 5: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx src/components/analysis/score-display.tsx src/components/analysis/structural-metrics.tsx src/components/analysis/semantic-terms-list.tsx
git commit -m "feat: add skeleton loading states to dashboard, score display, metrics, and terms list"
```

---

## Task 5: Add DropdownMenu and AlertDialog to guide cards

**Files:**
- Modify: `src/components/dashboard/guide-card.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Add dropdown menu with delete confirmation to guide card**

Replace the full file content of `src/components/dashboard/guide-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, ExternalLink, Copy, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface GuideCardProps {
  guide: {
    id: string
    keyword: string
    language: string
    score: number
    updated_at: string
  }
  onDelete?: (id: string) => void
}

function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'
  if (score <= 50) return '#f97316'
  if (score <= 70) return '#eab308'
  if (score <= 90) return '#22c55e'
  return '#3b82f6'
}

export function GuideCard({ guide, onDelete }: GuideCardProps) {
  const scoreColor = getScoreColor(guide.score)
  const updatedDate = new Date(guide.updated_at).toLocaleDateString('fr-FR')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  async function handleDelete() {
    try {
      const res = await fetch(`/api/guides/${guide.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Guide supprime')
        onDelete?.(guide.id)
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur reseau')
    }
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow group relative">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/guide/${guide.id}`} className="flex items-center">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ouvrir
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Duplication a venir')}>
                <Copy className="mr-2 h-4 w-4" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Share2 className="mr-2 h-4 w-4" />
                Partager
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link href={`/guide/${guide.id}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{guide.keyword}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{guide.language.toUpperCase()}</Badge>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: scoreColor }}>
                  {guide.score}
                </span>
                <span className="text-xs text-muted-foreground">/120</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Mis a jour le {updatedDate}
            </p>
          </CardContent>
        </Link>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce guide ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le guide &quot;{guide.keyword}&quot; sera supprime definitivement.
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

**Step 2: Wire up onDelete callback in dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`, update the guide card rendering to pass the `onDelete` prop:

Find this block:
```tsx
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
```

Replace with:
```tsx
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              onDelete={(id) => setGuides((prev) => prev.filter((g) => g.id !== id))}
            />
          ))}
        </div>
```

**Step 3: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/dashboard/guide-card.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add dropdown menu and delete confirmation to guide cards"
```

---

## Task 6: Add Breadcrumb navigation to editor

**Files:**
- Modify: `src/app/(editor)/guide/[id]/page.tsx`

**Step 1: Add breadcrumb to the editor header**

In `src/app/(editor)/guide/[id]/page.tsx`, add the breadcrumb import after existing imports:

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
```

Then replace this header section:
```tsx
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg">SERPmantics</h1>
          {guide && (
            <Badge variant="outline" className="text-sm">
              {guide.keyword}
            </Badge>
          )}
```

With:
```tsx
        <div className="flex items-center gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{guide?.keyword ?? 'Guide'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {guide && (
            <Badge variant="outline" className="text-sm">
              {guide.language.toUpperCase()}
            </Badge>
          )}
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/\(editor\)/guide/\[id\]/page.tsx
git commit -m "feat: add breadcrumb navigation to editor header"
```

---

## Task 7: Replace SERP benchmark with shadcn Table

**Files:**
- Modify: `src/components/analysis/serp-benchmark.tsx`

**Step 1: Replace card list with shadcn Table**

Replace the full file content of `src/components/analysis/serp-benchmark.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SortKey = 'position' | 'score' | 'words'

export function SerpBenchmark() {
  const pages = useGuideStore((s) => s.serpPages)
  const [sortBy, setSortBy] = useState<SortKey>('position')
  const [sortAsc, setSortAsc] = useState(true)

  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir le benchmark.</p>
  }

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(key)
      setSortAsc(true)
    }
  }

  const sorted = [...pages].sort((a, b) => {
    let aVal: number, bVal: number
    switch (sortBy) {
      case 'score':
        aVal = a.score; bVal = b.score; break
      case 'words':
        aVal = a.metrics.words; bVal = b.metrics.words; break
      default:
        aVal = a.position; bVal = b.position; break
    }
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  function SortButton({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSort(sortKey)}
        className="h-auto p-0 font-medium text-xs hover:bg-transparent"
      >
        {label}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    )
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Benchmark SERP</h3>
      <div className="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <SortButton label="#" sortKey="position" />
              </TableHead>
              <TableHead>Page</TableHead>
              <TableHead className="w-16 text-right">
                <SortButton label="Score" sortKey="score" />
              </TableHead>
              <TableHead className="w-16 text-right">
                <SortButton label="Mots" sortKey="words" />
              </TableHead>
              <TableHead className="w-14 text-right">Titres</TableHead>
              <TableHead className="w-14 text-right">Liens</TableHead>
              <TableHead className="w-14 text-right">Img</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((page) => (
              <TableRow key={page.id} className={page.is_excluded ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs">{page.position}</TableCell>
                <TableCell>
                  <div className="max-w-[180px]">
                    <p className="font-medium text-xs truncate">{page.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{page.url}</p>
                    {page.is_excluded && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">exclu</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">{page.score}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.words}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.headings}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.links}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.images}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/analysis/serp-benchmark.tsx
git commit -m "feat: replace SERP benchmark badges with sortable shadcn Table"
```

---

## Task 8: Add Popover color picker to toolbar

**Files:**
- Modify: `src/components/editor/toolbar.tsx`

**Step 1: Replace native color input with Popover**

Replace the full file content of `src/components/editor/toolbar.tsx`:

```tsx
'use client'

import { type Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Table, ImageIcon, Link, AlignLeft, AlignCenter,
  AlignRight, Undo, Redo, Highlighter, Type, Palette,
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
}

const TEXT_COLORS = [
  { name: 'Noir', value: '#000000' },
  { name: 'Gris', value: '#6b7280' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Jaune', value: '#eab308' },
  { name: 'Vert', value: '#22c55e' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Jaune', value: '#fef08a' },
  { name: 'Vert', value: '#bbf7d0' },
  { name: 'Bleu', value: '#bfdbfe' },
  { name: 'Rose', value: '#fecdd3' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Violet', value: '#ddd6fe' },
]

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

      {/* Text Color Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            <Palette size={iconSize} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium mb-2">Couleur du texte</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().setColor(color.value).run()}
                title={color.name}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight Color Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={editor.isActive('highlight') ? 'bg-muted' : ''}>
            <Highlighter size={iconSize} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium mb-2">Surlignage</p>
          <div className="grid grid-cols-3 gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
                title={color.name}
              />
            ))}
          </div>
          {editor.isActive('highlight') && (
            <button
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => editor.chain().focus().unsetHighlight().run()}
            >
              Supprimer le surlignage
            </button>
          )}
        </PopoverContent>
      </Popover>

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

**Step 2: Verify the app builds**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/editor/toolbar.tsx
git commit -m "feat: replace native color inputs with popover color pickers in toolbar"
```

---

## Task 9: Final verification

**Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with zero errors.

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No new lint errors.

**Step 3: Run existing tests**

Run: `pnpm test`
Expected: All existing tests pass.

**Step 4: Final commit if any fixes needed**

Only if Steps 1-3 revealed issues that needed fixing.
