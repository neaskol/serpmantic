'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { GuideCard } from '@/components/dashboard/guide-card'
import { CreateGuideDialog } from '@/components/dashboard/create-guide-dialog'
import { TextRazorUsageWidget } from '@/components/dashboard/textrazor-usage'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/error-boundary'

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
  const router = useRouter()
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

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Mes guides</h1>
          <p className="text-muted-foreground">Gerez vos guides d&apos;optimisation semantique</p>
        </div>
        <div className="flex items-center gap-3">
          <CreateGuideDialog />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Deconnexion
          </Button>
        </div>
      </div>

      {/* TextRazor Usage Widget */}
      <div className="mb-6">
        <TextRazorUsageWidget />
      </div>

      <ErrorBoundary>
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
              <GuideCard
                key={guide.id}
                guide={guide}
                onDelete={(id) => setGuides((prev) => prev.filter((g) => g.id !== id))}
              />
            ))}
          </div>
        )}
      </ErrorBoundary>
    </div>
  )
}
