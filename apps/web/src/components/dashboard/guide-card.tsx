'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, ExternalLink, Copy, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GuideCardProps {
  guide: {
    id: string
    keyword: string
    language: string
    score: number
    updated_at: string
  }
  onDelete?: (id: string) => void
}

function getScoreColor(score: number): string {
  if (score <= 30) return 'text-destructive'
  if (score <= 50) return 'text-warning'
  if (score <= 70) return 'text-warning'
  if (score <= 90) return 'text-success'
  return 'text-info'
}

export function GuideCard({ guide, onDelete }: GuideCardProps) {
  const scoreColor = getScoreColor(guide.score)
  const updatedDate = new Date(guide.updated_at).toLocaleDateString('fr-FR')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  async function handleDelete() {
    try {
      const res = await fetch(`/api/guides/${guide.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Guide supprime')
        onDelete?.(guide.id)
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur reseau')
    }
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow group relative">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/guide/${guide.id}`} />}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ouvrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Duplication a venir')}>
                <Copy className="mr-2 h-4 w-4" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Share2 className="mr-2 h-4 w-4" />
                Partager
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link href={`/guide/${guide.id}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{guide.keyword}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{guide.language.toUpperCase()}</Badge>
              <div className="flex items-center gap-2">
                <span className={cn("text-2xl font-bold", scoreColor)}>
                  {guide.score}
                </span>
                <span className="text-xs text-muted-foreground">/120</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Mis a jour le {updatedDate}
            </p>
          </CardContent>
        </Link>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce guide ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le guide &quot;{guide.keyword}&quot; sera supprime definitivement.
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
