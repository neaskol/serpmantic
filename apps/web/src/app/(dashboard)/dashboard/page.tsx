'use client'

import { useEffect, useState } from 'react'
import { GuideCard } from '@/components/dashboard/guide-card'
import { CreateGuideDialog } from '@/components/dashboard/create-guide-dialog'

interface Guide {
  id: string
  keyword: string
  language: string
  score: number
  updated_at: string
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
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
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
