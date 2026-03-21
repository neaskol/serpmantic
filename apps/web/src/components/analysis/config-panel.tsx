'use client'

import { useState, useEffect } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Globe,
  Lock,
  Eye,
  Edit3,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Calendar,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'

const LANGUAGES = [
  { value: 'fr', label: 'Francais', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Espanol', flag: '🇪🇸' },
]

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Prive', icon: <Lock className="size-3.5" />, description: 'Acces uniquement au proprietaire' },
  { value: 'read', label: 'Partage (Lecture)', icon: <Eye className="size-3.5" />, description: 'Acces en lecture seule via lien' },
  { value: 'edit', label: 'Partage (Edition)', icon: <Edit3 className="size-3.5" />, description: 'Acces en ecriture via lien' },
]

export function ConfigPanel() {
  const guide = useGuideStore((s) => s.guide)
  const serpAnalysis = useGuideStore((s) => s.serpAnalysis)
  const [visibility, setVisibility] = useState<string>(guide?.visibility ?? 'private')
  const [linkedUrl, setLinkedUrl] = useState(guide?.linked_url ?? '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (guide) {
      setVisibility(guide.visibility)
      setLinkedUrl(guide.linked_url ?? '')
    }
  }, [guide])

  const shareUrl = guide?.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${guide.share_token}`
    : null

  async function handleSave() {
    if (!guide) return
    setSaving(true)

    try {
      const res = await fetch(`/api/guides/${guide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility,
          linked_url: linkedUrl || null,
        }),
      })

      if (res.ok) {
        toast.success('Configuration sauvegardee')
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Lien copie')
  }

  function handleForceAnalysis() {
    toast.info('Utilisez le bouton "Analyser la SERP" dans la barre d\'outils pour relancer l\'analyse.')
  }

  const currentLanguage = LANGUAGES.find((l) => l.value === guide?.language)
  const refreshDate = serpAnalysis?.refresh_recommended_at
    ? new Date(serpAnalysis.refresh_recommended_at).toLocaleDateString('fr-FR')
    : null

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Configuration</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Parametres du guide, partage et connexion URL.
      </p>

      {/* Guide info */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Informations du guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Mot-cle</span>
            <Badge variant="secondary" className="text-xs">{guide?.keyword ?? '-'}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Langue</span>
            <span className="text-xs">
              {currentLanguage ? `${currentLanguage.flag} ${currentLanguage.label}` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Moteur de recherche</span>
            <span className="text-xs">{guide?.search_engine ?? '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cree le</span>
            <span className="text-xs">
              {guide?.created_at ? new Date(guide.created_at).toLocaleDateString('fr-FR') : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Modifie le</span>
            <span className="text-xs">
              {guide?.updated_at ? new Date(guide.updated_at).toLocaleDateString('fr-FR') : '-'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Visibility / Sharing */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Mode de partage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setVisibility(option.value)}
                className={`w-full flex items-start gap-2.5 p-2 rounded-lg border transition-colors text-left ${
                  visibility === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted/50'
                }`}
              >
                <div className={`mt-0.5 ${visibility === option.value ? 'text-primary' : 'text-muted-foreground'}`}>
                  {option.icon}
                </div>
                <div>
                  <p className={`text-xs font-medium ${visibility === option.value ? 'text-primary' : ''}`}>
                    {option.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{option.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Share link */}
          {visibility !== 'private' && shareUrl && (
            <div className="flex items-center gap-1.5">
              <Input
                value={shareUrl}
                readOnly
                className="h-7 text-xs flex-1"
              />
              <Button
                size="icon-xs"
                variant="outline"
                onClick={handleCopyShareLink}
                aria-label="Copier le lien de partage"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              </Button>
            </div>
          )}

          {visibility !== 'private' && !shareUrl && (
            <p className="text-xs text-muted-foreground">
              Sauvegardez pour generer un lien de partage.
            </p>
          )}
        </CardContent>
      </Card>

      {/* URL Connection */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Connexion URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Liez la page publiee a ce guide pour suivre les changements.
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="https://monsite.com/mon-article"
              value={linkedUrl}
              onChange={(e) => setLinkedUrl(e.target.value)}
              className="h-7 text-xs flex-1"
            />
            <Button size="icon-xs" variant="outline" disabled aria-label="Lier la page">
              <Link2 className="size-3" />
            </Button>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Surveillance — Bientot disponible
          </Badge>
        </CardContent>
      </Card>

      {/* Refresh recommendation */}
      {serpAnalysis && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs">Mise a jour recommandee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Frequence</span>
              </div>
              <span className="text-xs font-medium">
                Tous les {serpAnalysis.refresh_interval_months} mois
              </span>
            </div>
            {refreshDate && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Prochain update</span>
                </div>
                <span className="text-xs font-medium">{refreshDate}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={handleSave}
          disabled={saving || !guide}
          className="w-full"
        >
          {saving ? (
            <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Enregistrer la configuration
        </Button>

        <Button
          onClick={handleForceAnalysis}
          variant="outline"
          className="w-full"
          disabled={!guide}
        >
          <RefreshCw className="size-4" />
          Forcer l&apos;analyse du contenu
        </Button>
      </div>

      <Separator />

      {/* Back to dashboard */}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={() => window.location.href = '/dashboard'}
      >
        <Globe className="size-4" />
        Retour a la liste des guides
      </Button>

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>
    </div>
  )
}
