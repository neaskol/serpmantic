'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

export type AnalysisStep = 'idle' | 'fetching' | 'crawling' | 'nlp' | 'saving' | 'complete' | 'error'

export interface AnalysisError {
  step: AnalysisStep
  message: string
  details?: string
  canRetry: boolean
}

interface AnalysisProgressProps {
  currentStep: AnalysisStep
  error?: AnalysisError
  onRetry?: () => void
}

const STEPS: { id: AnalysisStep; label: string; estimatedTime: string }[] = [
  { id: 'fetching', label: 'Récupération des résultats SERP', estimatedTime: '2-5s' },
  { id: 'crawling', label: 'Crawl des 10 pages concurrentes', estimatedTime: '10-30s' },
  { id: 'nlp', label: 'Analyse NLP et extraction sémantique', estimatedTime: '15-45s' },
  { id: 'saving', label: 'Sauvegarde des résultats', estimatedTime: '2-5s' },
]

const getStepIndex = (step: AnalysisStep): number => {
  return STEPS.findIndex(s => s.id === step)
}

const getProgressPercentage = (step: AnalysisStep): number => {
  if (step === 'idle') return 0
  if (step === 'complete') return 100
  if (step === 'error') return 0

  const stepIndex = getStepIndex(step)
  if (stepIndex === -1) return 0

  return ((stepIndex + 1) / STEPS.length) * 100
}

export function SerpAnalysisProgress({ currentStep, error, onRetry }: AnalysisProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const progress = getProgressPercentage(currentStep)
  const currentStepIndex = getStepIndex(currentStep)

  // Timer for elapsed time
  useEffect(() => {
    if (currentStep === 'idle' || currentStep === 'complete' || currentStep === 'error') {
      setElapsedTime(0)
      return
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [currentStep])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  if (currentStep === 'idle') {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-white">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <span className="text-sm font-medium">Préparation de l'analyse SERP...</span>
        </div>
      </div>
    )
  }

  if (currentStep === 'complete') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900">
          Analyse SERP terminée avec succès !
        </AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold text-red-900">
              Erreur lors de l'étape : {STEPS.find(s => s.id === error.step)?.label || error.step}
            </p>
            <p className="text-sm text-red-800">{error.message}</p>
            {error.details && (
              <details className="text-xs text-red-700">
                <summary className="cursor-pointer hover:underline">Détails techniques</summary>
                <pre className="mt-1 p-2 bg-red-100 rounded overflow-x-auto">{error.details}</pre>
              </details>
            )}
            {error.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
              >
                Réessayer
              </button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Analyse SERP en cours...</span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step details */}
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isActive = currentStepIndex === index
          const isComplete = currentStepIndex > index
          const isPending = currentStepIndex < index

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Status icon */}
              <div className="mt-0.5">
                {isComplete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {isActive && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                {isPending && <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
              </div>

              {/* Step info */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-blue-900' :
                    isComplete ? 'text-green-900' :
                    'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ~{step.estimatedTime}
                  </span>
                </div>

                {/* Warning for slow steps */}
                {isActive && index === 1 && elapsedTime > 30 && (
                  <div className="flex items-start gap-1 text-xs text-orange-600">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Le crawling peut être ralenti par des sites lents ou protégés</span>
                  </div>
                )}

                {isActive && index === 2 && elapsedTime > 60 && (
                  <div className="flex items-start gap-1 text-xs text-orange-600">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Le service NLP peut avoir un temps de démarrage initial (cold start)</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Total estimated time */}
      <div className="pt-3 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Temps total estimé : 30-90 secondes
        </p>
      </div>
    </div>
  )
}
