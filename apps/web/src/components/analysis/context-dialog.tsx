'use client'

import { useState } from 'react'
import { useContextStore } from '@/stores/context-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PromptContextRecord } from '@/types/database'

interface ContextDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContextDialog({ open, onOpenChange }: ContextDialogProps) {
  const contexts = useContextStore((s) => s.contexts)
  const createContext = useContextStore((s) => s.createContext)
  const updateContext = useContextStore((s) => s.updateContext)
  const deleteContext = useContextStore((s) => s.deleteContext)

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingContext, setEditingContext] = useState<PromptContextRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [sector, setSector] = useState('')
  const [brief, setBrief] = useState('')

  function resetForm() {
    setName('')
    setAudience('')
    setTone('')
    setSector('')
    setBrief('')
    setEditingContext(null)
    setMode('list')
  }

  function handleEdit(ctx: PromptContextRecord) {
    setEditingContext(ctx)
    setName(ctx.name)
    setAudience(ctx.audience)
    setTone(ctx.tone)
    setSector(ctx.sector)
    setBrief(ctx.brief)
    setMode('edit')
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Le nom du contexte est requis')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const result = await createContext({ name: name.trim(), audience, tone, sector, brief })
        if (result) {
          toast.success('Contexte créé')
          resetForm()
        } else {
          toast.error('Erreur lors de la création')
        }
      } else if (mode === 'edit' && editingContext) {
        await updateContext(editingContext.id, { name: name.trim(), audience, tone, sector, brief })
        toast.success('Contexte mis à jour')
        resetForm()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteContext(id)
    toast.success('Contexte supprimé')
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'list' ? 'Gérer les contextes' : mode === 'create' ? 'Nouveau contexte' : 'Modifier le contexte'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'list'
              ? 'Les contextes enrichissent vos prompts IA avec des informations sur votre audience, ton et secteur.'
              : 'Remplissez les champs pour personnaliser les prompts IA.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <>
            <ScrollArea className="max-h-[40vh]">
              {contexts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun contexte. Créez-en un pour personnaliser vos prompts.
                </p>
              ) : (
                <div className="space-y-2">
                  {contexts.map((ctx) => (
                    <div key={ctx.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ctx.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[ctx.audience, ctx.tone, ctx.sector].filter(Boolean).join(' / ') || 'Non configuré'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon-xs" variant="ghost" onClick={() => handleEdit(ctx)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button size="icon-xs" variant="ghost" onClick={() => handleDelete(ctx.id)}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button onClick={() => setMode('create')}>
                <Plus className="size-3.5 mr-1" />
                Nouveau contexte
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label htmlFor="ctx-name" className="text-xs font-medium block mb-1">Nom *</label>
                <Input id="ctx-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Blog tech B2B" className="h-8 text-sm" />
              </div>
              <div>
                <label htmlFor="ctx-audience" className="text-xs font-medium block mb-1">Audience cible</label>
                <Input id="ctx-audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ex: Développeurs web, CTOs" className="h-8 text-sm" />
              </div>
              <div>
                <label htmlFor="ctx-tone" className="text-xs font-medium block mb-1">Ton</label>
                <Input id="ctx-tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Ex: Professionnel, pédagogique" className="h-8 text-sm" />
              </div>
              <div>
                <label htmlFor="ctx-sector" className="text-xs font-medium block mb-1">Secteur</label>
                <Input id="ctx-sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex: SaaS, e-commerce" className="h-8 text-sm" />
              </div>
              <div>
                <label htmlFor="ctx-brief" className="text-xs font-medium block mb-1">Brief</label>
                <Input id="ctx-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ex: Article de fond pour le blog..." className="h-8 text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Retour
              </Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? 'Enregistrement...' : mode === 'create' ? 'Créer' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
