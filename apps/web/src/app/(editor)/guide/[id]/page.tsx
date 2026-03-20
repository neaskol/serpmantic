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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import Link from 'next/link'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'

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

    // Normalize search engine to full URL if needed
    let searchEngineUrl = guide.search_engine
    if (!searchEngineUrl.startsWith('http://') && !searchEngineUrl.startsWith('https://')) {
      searchEngineUrl = `https://${searchEngineUrl}`
    }

    toast.promise(
      (async () => {
        const res = await fetch('/api/serp/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: guide.keyword,
            language: guide.language,
            searchEngine: searchEngineUrl,
            guideId: guide.id,
          }),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.message || errorData.error || 'Analyse echouee')
        }
        const data = await res.json()
        setSerpData(data.analysis, data.pages, data.terms)
        return data
      })().finally(() => setAnalyzing(false)),
      {
        loading: 'Analyse SERP en cours...',
        success: 'Analyse terminee !',
        error: (err) => err instanceof Error ? err.message : 'Erreur lors de l\'analyse SERP',
      }
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
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
            <ErrorBoundary>
              <TiptapEditor />
            </ErrorBoundary>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={25}>
          <ErrorBoundary>
            <AnalysisPanel />
          </ErrorBoundary>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Score bar footer */}
      <div className="h-1.5" style={{ backgroundColor: scoreColor }} />
    </div>
  )
}
