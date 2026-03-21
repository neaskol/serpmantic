'use client'

import { useState, useEffect } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { useEditorStore } from '@/stores/editor-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { FileSearch, Copy, Check, Sparkles, Save, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

type MetaSuggestion = {
  title: string
  description: string
}

export function MetaPanel() {
  const guide = useGuideStore((s) => s.guide)
  const setGuide = useGuideStore((s) => s.setGuide)
  const plainText = useEditorStore((s) => s.plainText)
  const [metaTitle, setMetaTitle] = useState(guide?.meta_title ?? '')
  const [metaDescription, setMetaDescription] = useState(guide?.meta_description ?? '')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<MetaSuggestion[] | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Sync with guide data when it changes
  useEffect(() => {
    if (guide) {
      setMetaTitle(guide.meta_title ?? '')
      setMetaDescription(guide.meta_description ?? '')
    }
  }, [guide])

  async function handleSave() {
    if (!guide) return
    setSaving(true)

    // Capture previous values for rollback
    const prevTitle = guide.meta_title ?? ''
    const prevDesc = guide.meta_description ?? ''

    try {
      const res = await fetch(`/api/guides/${guide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTitle: metaTitle,
          metaDescription: metaDescription,
        }),
      })

      if (res.ok) {
        const updatedGuide = await res.json()
        setGuide(updatedGuide) // Sync guide-store with server state
        toast.success('Meta tags sauvegardees')
      } else {
        // Revert on failure
        setMetaTitle(prevTitle)
        setMetaDescription(prevDesc)
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      // Revert on network error
      setMetaTitle(prevTitle)
      setMetaDescription(prevDesc)
      toast.error('Erreur reseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleSuggest() {
    if (!guide) return
    setGenerating(true)

    try {
      const res = await fetch('/api/ai/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: guide.keyword,
          language: guide.language,
          content: plainText.slice(0, 2000),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.message || 'Erreur lors de la generation des meta tags')
        return
      }

      const data = await res.json()
      setSuggestions(data.suggestions)
    } catch {
      toast.error('Erreur lors de la generation des suggestions. Veuillez reessayer.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(text: string, field: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('Copie !')
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Impossible de copier dans le presse-papiers')
    }
  }

  function applySuggestion(suggestion: MetaSuggestion) {
    setMetaTitle(suggestion.title)
    setMetaDescription(suggestion.description)
    setSuggestions(null)
    toast.success('Suggestion appliquee')
  }

  const titleLength = metaTitle.length
  const descriptionLength = metaDescription.length
  const titleOk = titleLength > 0 && titleLength <= 60
  const descriptionOk = descriptionLength > 0 && descriptionLength <= 158

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileSearch className="size-5 text-primary" />
        <h3 className="font-semibold text-base">Meta Tags</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Optimisez le titre et la meta description de votre page pour le SEO.
      </p>

      {/* Meta title */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium">Titre de la page</label>
          <div className="flex items-center gap-1.5">
            <Badge
              variant={titleOk ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {titleLength}/60
            </Badge>
            <button
              onClick={() => handleCopy(metaTitle, 'title')}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              aria-label="Copier le titre"
            >
              {copiedField === 'title' ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        <Input
          placeholder="Titre SEO de votre page..."
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          className="text-sm"
          maxLength={70}
        />
        {titleLength > 60 && (
          <p className="text-[10px] text-destructive mt-0.5">
            Le titre depasse 60 caracteres. Il risque d&apos;etre tronque dans les resultats Google.
          </p>
        )}
      </div>

      {/* Meta description */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium">Meta description</label>
          <div className="flex items-center gap-1.5">
            <Badge
              variant={descriptionOk ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {descriptionLength}/158
            </Badge>
            <button
              onClick={() => handleCopy(metaDescription, 'description')}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              aria-label="Copier la description"
            >
              {copiedField === 'description' ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        <textarea
          placeholder="Meta description de votre page..."
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          maxLength={200}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none dark:bg-input/30"
        />
        {descriptionLength > 158 && (
          <p className="text-[10px] text-destructive mt-0.5">
            La description depasse 158 caracteres. Elle risque d&apos;etre tronquee.
          </p>
        )}
      </div>

      {/* SERP Preview */}
      <Card size="sm" className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-xs text-muted-foreground">Apercu Google</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            <p className="text-[#1a0dab] text-sm truncate cursor-pointer hover:underline">
              {metaTitle || 'Titre de votre page'}
            </p>
            <p className="text-[#006621] text-xs truncate">
              {guide?.linked_url || 'https://votre-site.com/votre-page'}
            </p>
            <p className="text-xs text-[#545454] line-clamp-2">
              {metaDescription || 'La meta description de votre page apparaitra ici...'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !guide}
          size="sm"
          className="flex-1"
        >
          {saving ? (
            <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Enregistrer
        </Button>
        <Button
          onClick={handleSuggest}
          disabled={generating || !guide || plainText.trim().length < 10}
          size="sm"
          variant="outline"
          className="flex-1"
        >
          {generating ? (
            <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Suggerer des idees
        </Button>
      </div>

      {plainText.trim().length < 10 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Redigez du contenu dans l&apos;editeur pour obtenir des suggestions de meta tags.
        </p>
      )}

      {/* AI Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold mb-2">Suggestions IA</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <Card key={i} size="sm" className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => applySuggestion(suggestion)}>
                  <CardContent className="py-2 px-3 space-y-1">
                    <p className="text-sm font-medium text-[#1a0dab]">{suggestion.title}</p>
                    <p className="text-xs text-[#545454]">{suggestion.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Titre: {suggestion.title.length}/60
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Desc: {suggestion.description.length}/158
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Help section */}
      <Separator />

      <button
        onClick={() => setShowHelp(!showHelp)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <BookOpen className="size-4" />
        Guide des bonnes pratiques
        {showHelp ? <ChevronUp className="size-4 ml-auto" /> : <ChevronDown className="size-4 ml-auto" />}
      </button>

      {showHelp && (
        <Card size="sm" className="bg-muted/30">
          <CardContent className="py-3 px-3 space-y-2">
            <p className="text-xs font-medium">Titre (max 60 caracteres)</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
              <li>Incluez le mot-cle principal au debut</li>
              <li>Soyez specifique et attrayant</li>
              <li>Evitez le bourrage de mots-cles</li>
            </ul>
            <p className="text-xs font-medium mt-2">Description (max 158 caracteres)</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
              <li>Resumez le contenu de la page</li>
              <li>Incluez un appel a l&apos;action</li>
              <li>Utilisez le mot-cle naturellement</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Des idees ou remarques ? contact@serpmantics.com
        </p>
      </div>
    </div>
  )
}
