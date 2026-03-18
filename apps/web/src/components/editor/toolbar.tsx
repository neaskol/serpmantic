'use client'

import { type Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Table, ImageIcon, Link, AlignLeft, AlignCenter,
  AlignRight, Undo, Redo, Highlighter, Type,
} from 'lucide-react'

interface ToolbarProps {
  editor: Editor | null
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  const iconSize = 16

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b p-2 bg-white sticky top-0 z-10">
      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
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
      >
        <Type size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Formatting */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'bg-muted' : ''}>
        <Bold size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'bg-muted' : ''}>
        <Italic size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'bg-muted' : ''}>
        <Underline size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'bg-muted' : ''}>
        <Highlighter size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}>
        <AlignLeft size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}>
        <AlignCenter size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}>
        <AlignRight size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'bg-muted' : ''}>
        <List size={iconSize} />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'bg-muted' : ''}>
        <ListOrdered size={iconSize} />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Table */}
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table size={iconSize} />
      </Button>

      {/* Image */}
      <Button variant="ghost" size="sm" onClick={() => {
        const url = window.prompt('URL de l\'image')
        if (url) editor.chain().focus().setImage({ src: url }).run()
      }}>
        <ImageIcon size={iconSize} />
      </Button>

      {/* Link */}
      <Button variant="ghost" size="sm" onClick={() => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run()
        } else {
          const url = window.prompt('URL du lien')
          if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
      }} className={editor.isActive('link') ? 'bg-muted' : ''}>
        <Link size={iconSize} />
      </Button>
    </div>
  )
}
