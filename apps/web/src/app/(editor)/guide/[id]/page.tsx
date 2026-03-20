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
import { SerpAnalysisProgress, type AnalysisStep, type AnalysisError } from '@/components/analysis/serp-analysis-progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [analysisError, setAnalysisError] = useState<AnalysisError | undefined>()
  const [showProgressDialog, setShowProgressDialog] = useState(false)
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

  // SERP analysis handler with progress tracking
  async function handleAnalyze() {
    if (!guide) return

    setAnalyzing(true)
    setAnalysisStep('idle')
    setAnalysisError(undefined)
    setShowProgressDialog(true)

    // Normalize search engine to full URL if needed
    let searchEngineUrl = guide.search_engine
    if (!searchEngineUrl.startsWith('http://') && !searchEngineUrl.startsWith('https://')) {
      searchEngineUrl = `https://${searchEngineUrl}`
    }

    try {
      // Step 1: Fetching SERP
      setAnalysisStep('fetching')
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay to show step

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

        // Determine which step failed based on error message
        let failedStep: AnalysisStep = 'fetching'
        if (errorData.message?.includes('crawl') || errorData.error?.includes('crawl')) {
          failedStep = 'crawling'
        } else if (errorData.message?.includes('NLP') || errorData.error?.includes('NLP')) {
          failedStep = 'nlp'
        } else if (errorData.message?.includes('save') || errorData.error?.includes('save')) {
          failedStep = 'saving'
        }

        const error: AnalysisError = {
          step: failedStep,
          message: errorData.message || errorData.error || 'Analyse échouée',
          details: errorData.details ? JSON.stringify(errorData.details, null, 2) : undefined,
          canRetry: res.status !== 429, // Don't retry if rate limited
        }

        setAnalysisError(error)
        setAnalysisStep('error')
        toast.error(error.message)
        return
      }

      // Simulate step progression (since we don't have real-time updates from backend)
      setAnalysisStep('crawling')
      await new Promise(resolve => setTimeout(resolve, 1000))

      setAnalysisStep('nlp')
      await new Promise(resolve => setTimeout(resolve, 1000))

      setAnalysisStep('saving')

      const data = await res.json()
      setSerpData(data.analysis, data.pages, data.terms)

      setAnalysisStep('complete')
      toast.success('Analyse SERP terminée avec succès !')

      // Auto-close dialog after success
      setTimeout(() => {
        setShowProgressDialog(false)
        setAnalysisStep('idle')
      }, 2000)

    } catch (error) {
      const err: AnalysisError = {
        step: analysisStep === 'idle' ? 'fetching' : analysisStep,
        message: error instanceof Error ? error.message : 'Erreur réseau',
        details: error instanceof Error ? error.stack : undefined,
        canRetry: true,
      }
      setAnalysisError(err)
      setAnalysisStep('error')
      toast.error(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleRetryAnalysis() {
    setAnalysisError(undefined)
    setAnalysisStep('idle')
    handleAnalyze()
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

      {/* Analysis Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Analyse SERP</DialogTitle>
            <DialogDescription>
              Analyse sémantique approfondie de la SERP Google pour "{guide?.keyword}"
            </DialogDescription>
          </DialogHeader>
          <SerpAnalysisProgress
            currentStep={analysisStep}
            error={analysisError}
            onRetry={handleRetryAnalysis}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
