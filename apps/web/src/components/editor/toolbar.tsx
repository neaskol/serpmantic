'use client'

import { useState } from 'react'
import { type Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Table, ImageIcon, Link, AlignLeft, AlignCenter,
  AlignRight, Undo, Redo, Highlighter, Type, Palette,
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
}

const TEXT_COLORS = [
  { name: 'Noir', value: '#000000' },
  { name: 'Gris', value: '#6b7280' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Jaune', value: '#eab308' },
  { name: 'Vert', value: '#22c55e' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Jaune', value: '#fef08a' },
  { name: 'Vert', value: '#bbf7d0' },
  { name: 'Bleu', value: '#bfdbfe' },
  { name: 'Rose', value: '#fecdd3' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Violet', value: '#ddd6fe' },
]

export function Toolbar({ editor }: ToolbarProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  if (!editor) return null

  const iconSize = 16

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b p-2 bg-white sticky top-0 z-10">
      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)">
        <Undo size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label="Retablir (Ctrl+Y)" title="Retablir (Ctrl+Y)">
        <Redo size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      {([1, 2, 3, 4] as const).map((level) => {
        const Icon = [Heading1, Heading2, Heading3, Heading4][level - 1]
        return (
          <Button
            key={level}
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            className={editor.isActive('heading', { level }) ? 'bg-muted' : ''}
            aria-label={`Titre H${level}`}
            aria-pressed={editor.isActive('heading', { level })}
          >
            <Icon size={iconSize} />
          </Button>
        )
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={editor.isActive('paragraph') ? 'bg-muted' : ''}
        aria-label="Paragraphe"
        aria-pressed={editor.isActive('paragraph')}
      >
        <Type size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Formatting */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-muted' : ''} aria-label="Gras (Ctrl+B)" aria-pressed={editor.isActive('bold')} title="Gras (Ctrl+B)">
        <Bold size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-muted' : ''} aria-label="Italique (Ctrl+I)" aria-pressed={editor.isActive('italic')} title="Italique (Ctrl+I)">
        <Italic size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'bg-muted' : ''} aria-label="Souligne (Ctrl+U)" aria-pressed={editor.isActive('underline')} title="Souligne (Ctrl+U)">
        <Underline size={iconSize} />
      </Button>

      {/* Text Color Popover */}
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label="Couleur du texte" />}>
          <Palette size={iconSize} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium mb-2">Couleur du texte</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().setColor(color.value).run()}
                title={color.name}
                aria-label={color.name}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight Color Popover */}
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="sm" className={editor.isActive('highlight') ? 'bg-muted' : ''} aria-label="Surlignage" aria-pressed={editor.isActive('highlight')} />}>
          <Highlighter size={iconSize} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium mb-2">Surlignage</p>
          <div className="grid grid-cols-3 gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
                title={color.name}
                aria-label={color.name}
              />
            ))}
          </div>
          {editor.isActive('highlight') && (
            <button
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => editor.chain().focus().unsetHighlight().run()}
            >
              Supprimer le surlignage
            </button>
          )}
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''} aria-label="Aligner a gauche" aria-pressed={editor.isActive({ textAlign: 'left' })}>
        <AlignLeft size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''} aria-label="Centrer" aria-pressed={editor.isActive({ textAlign: 'center' })}>
        <AlignCenter size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''} aria-label="Aligner a droite" aria-pressed={editor.isActive({ textAlign: 'right' })}>
        <AlignRight size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'bg-muted' : ''} aria-label="Liste a puces" aria-pressed={editor.isActive('bulletList')} title="Liste a puces">
        <List size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'bg-muted' : ''} aria-label="Liste numerotee" aria-pressed={editor.isActive('orderedList')} title="Liste numerotee">
        <ListOrdered size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Table */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} aria-label="Inserer un tableau" title="Inserer un tableau">
        <Table size={iconSize} />
      </Button>

      {/* Image */}
      <Button variant="ghost" size="sm" onClick={() => { setUrlInput(''); setImageDialogOpen(true) }} aria-label="Inserer une image" title="Inserer une image">
        <ImageIcon size={iconSize} />
      </Button>

      {/* Link */}
      <Button variant="ghost" size="sm" onClick={() => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
        } else {
          setUrlInput('')
          setLinkDialogOpen(true)
        }
      }} className={editor.isActive('link') ? 'bg-muted' : ''} aria-label="Inserer un lien" aria-pressed={editor.isActive('link')} title="Inserer/supprimer un lien">
        <Link size={iconSize} />
      </Button>

      {/* Image URL Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Inserer une image</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="image-url" className="text-sm font-medium">URL de l&apos;image</label>
            <Input
              id="image-url"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  editor.chain().focus().setImage({ src: urlInput.trim() }).run()
                  setImageDialogOpen(false)
                  setUrlInput('')
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImageDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!urlInput.trim()}
              onClick={() => {
                editor.chain().focus().setImage({ src: urlInput.trim() }).run()
                setImageDialogOpen(false)
                setUrlInput('')
              }}
            >
              Inserer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link URL Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Inserer un lien</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="link-url" className="text-sm font-medium">URL du lien</label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: urlInput.trim() }).run()
                  setLinkDialogOpen(false)
                  setUrlInput('')
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!urlInput.trim()}
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').setLink({ href: urlInput.trim() }).run()
                setLinkDialogOpen(false)
                setUrlInput('')
              }}
            >
              Inserer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
