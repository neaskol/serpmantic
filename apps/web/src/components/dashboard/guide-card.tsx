'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface GuideCardProps {
  guide: {
    id: string
    keyword: string
    language: string
    score: number
    updated_at: string
  }
}

function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'
  if (score <= 50) return '#f97316'
  if (score <= 70) return '#eab308'
  if (score <= 90) return '#22c55e'
  return '#3b82f6'
}

export function GuideCard({ guide }: GuideCardProps) {
  const scoreColor = getScoreColor(guide.score)
  const updatedDate = new Date(guide.updated_at).toLocaleDateString('fr-FR')

  return (
    <Link href={`/guide/${guide.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
      </Card>
    </Link>
  )
}
