'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Espanol' },
  { value: 'it', label: 'Italiano' },
]

export function CreateGuideDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [language, setLanguage] = useState('fr')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!keyword.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          language,
          searchEngine: language === 'fr' ? 'google.fr' : 'google.com',
        }),
      })

      if (res.ok) {
        const guide = await res.json()
        toast.success('Guide cree avec succes')
        setOpen(false)
        router.push(`/guide/${guide.id}`)
      } else {
        toast.error('Erreur lors de la creation du guide')
      }
    } catch {
      toast.error('Erreur reseau')
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        Nouveau guide
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Creer un nouveau guide</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot-cle cible</label>
            <Input
              placeholder="Ex: delegataire cee"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Langue</label>
            <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une langue" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={loading || !keyword.trim()} className="w-full">
            {loading ? 'Creation...' : 'Creer le guide'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
