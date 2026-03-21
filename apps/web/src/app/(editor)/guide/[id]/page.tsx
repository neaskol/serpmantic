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
import { Check } from 'lucide-react'
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
  const clearSerpData = useGuideStore((s) => s.clearSerpData)
  const recalculateScore = useGuideStore((s) => s.recalculateScore)
  const semanticTerms = useGuideStore((s) => s.semanticTerms)
  const content = useEditorStore((s) => s.content)
  const setInitialContent = useEditorStore((s) => s.setInitialContent)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [analysisError, setAnalysisError] = useState<AnalysisError | undefined>()
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch guide on mount
  useEffect(() => {
    async function loadGuide() {
      const res = await fetch(`/api/guides/${id}`)
      if (res.ok) {
        const data = await res.json()
        console.log('[Guide Load] Data received:', {
          hasGuide: !!data.guide,
          hasAnalysis: !!data.analysis,
          pagesCount: data.pages?.length || 0,
          termsCount: data.terms?.length || 0,
        })
        setGuide(data.guide)
        // Restore editor content from saved guide
        if (data.guide.content && Object.keys(data.guide.content).length > 0) {
          console.log('[Guide Load] Restoring editor content from database')
          setInitialContent(data.guide.content)
        }
        if (data.analysis && data.terms?.length > 0) {
          console.log('[Guide Load] Setting SERP data in store', {
            analysisId: data.analysis.id,
            pagesCount: data.pages?.length,
            termsCount: data.terms?.length,
          })
          setSerpData(data.analysis, data.pages || [], data.terms)
        } else {
          console.log('[Guide Load] No SERP data found in database', {
            analysis: data.analysis,
            pages: data.pages?.length,
            terms: data.terms?.length,
          })
        }
      } else {
        toast.error('Impossible de charger le guide')
      }
    }
    if (id && id !== 'test') {
      setLoading(true)
      loadGuide().finally(() => setLoading(false))
    }
  }, [id, setGuide, setSerpData, setInitialContent])

  // Recalculate score when SERP data becomes available (or changes)
  // This ensures termStatuses and structuralMetrics are populated even with an empty editor
  useEffect(() => {
    if (semanticTerms.length > 0) {
      const currentText = useEditorStore.getState().plainText
      const currentContent = useEditorStore.getState().content
      recalculateScore(currentText, currentContent as Record<string, unknown>)
    }
  }, [semanticTerms, recalculateScore])

  // Auto-save content with debounce
  useEffect(() => {
    if (!guide || !content || Object.keys(content).length === 0) return

    if (saveRef.current) clearTimeout(saveRef.current)
    setSaveStatus('saving')
    saveRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/guides/${guide.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, score }),
        })
        if (res.ok) {
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 3000)
        } else {
          setSaveStatus('error')
          toast.error('Erreur lors de la sauvegarde')
        }
      } catch {
        setSaveStatus('error')
        toast.error('Erreur reseau lors de la sauvegarde')
      }
    }, 3000)

    return () => {
      if (saveRef.current) clearTimeout(saveRef.current)
    }
  }, [content, guide, score])

  // Poll job status
  async function pollJobStatus(jobId: string) {
    try {
      const res = await fetch(`/api/serp/job-status/${jobId}`)
      if (!res.ok) return

      const data = await res.json()

      // Update progress step based on job status
      const stepMap: Record<string, AnalysisStep> = {
        pending: 'idle',
        processing: data.progressStep || 'fetching',
        completed: 'complete',
        failed: 'error',
      }

      const newStep = stepMap[data.status] || 'fetching'
      setAnalysisStep(newStep)

      // If completed successfully
      if (data.status === 'completed' && data.data) {
        setSerpData(data.data.analysis, data.data.pages, data.data.terms)
        toast.success('Analyse SERP terminée avec succès !')

        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }

        // Auto-close dialog
        setTimeout(() => {
          setShowProgressDialog(false)
          setAnalysisStep('idle')
          setCurrentJobId(null)
          setAnalyzing(false)
        }, 2000)
      }

      // If failed
      if (data.status === 'failed') {
        const error: AnalysisError = {
          step: newStep,
          message: data.error || 'L\'analyse a échoué',
          details: data.errorDetails ? JSON.stringify(data.errorDetails, null, 2) : undefined,
          canRetry: true,
        }
        setAnalysisError(error)
        toast.error(error.message)

        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }

        setAnalyzing(false)
      }
    } catch (error) {
      console.error('Error polling job status:', error)
    }
  }

  // SERP analysis handler with async job
  async function handleAnalyze() {
    if (!guide) return

    setAnalyzing(true)
    setAnalysisStep('idle')
    setAnalysisError(undefined)
    setShowProgressDialog(true)
    clearSerpData()

    // Normalize search engine to full URL if needed
    let searchEngineUrl = guide.search_engine
    if (!searchEngineUrl.startsWith('http://') && !searchEngineUrl.startsWith('https://')) {
      searchEngineUrl = `https://${searchEngineUrl}`
    }

    try {
      // Create job
      const res = await fetch('/api/serp/analyze-v2', {
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

        const error: AnalysisError = {
          step: 'fetching',
          message: errorData.message || errorData.error || 'Impossible de démarrer l\'analyse',
          details: errorData.details ? JSON.stringify(errorData.details, null, 2) : undefined,
          canRetry: res.status !== 429,
        }

        setAnalysisError(error)
        setAnalysisStep('error')
        toast.error(error.message)
        setAnalyzing(false)
        return
      }

      const data = await res.json()
      setCurrentJobId(data.jobId)
      setAnalysisStep('fetching')

      // Start polling every 2 seconds
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatus(data.jobId)
      }, 2000)

      // Initial poll
      pollJobStatus(data.jobId)

    } catch (error) {
      const err: AnalysisError = {
        step: 'fetching',
        message: error instanceof Error ? error.message : 'Erreur réseau',
        details: error instanceof Error ? error.stack : undefined,
        canRetry: true,
      }
      setAnalysisError(err)
      setAnalysisStep('error')
      toast.error(err.message)
      setAnalyzing(false)
    }
  }

  function handleRetryAnalysis() {
    setAnalysisError(undefined)
    setAnalysisStep('idle')
    setCurrentJobId(null)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    handleAnalyze()
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

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
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="size-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="size-3" />
              Sauvegarde
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              Erreur
            </span>
          )}
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
