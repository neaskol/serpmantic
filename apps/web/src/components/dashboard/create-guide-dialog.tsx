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

export function CreateGuideDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [language, setLanguage] = useState('fr')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!keyword.trim()) return
    setLoading(true)

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
      setOpen(false)
      router.push(`/guide/${guide.id}`)
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
          <div>
            <label className="text-sm font-medium">Mot-cle cible</label>
            <Input
              placeholder="Ex: delegataire cee"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Langue</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full border rounded-md p-2 text-sm"
            >
              <option value="fr">Francais</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="es">Espanol</option>
              <option value="it">Italiano</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={loading || !keyword.trim()} className="w-full">
            {loading ? 'Creation...' : 'Creer le guide'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
