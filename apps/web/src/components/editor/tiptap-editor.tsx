'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import { Toolbar } from './toolbar'
import { useEditorStore } from '@/stores/editor-store'
import { useGuideStore } from '@/stores/guide-store'

export function TiptapEditor() {
  const setContent = useEditorStore((s) => s.setContent)
  const setPlainText = useEditorStore((s) => s.setPlainText)
  const recalculateScore = useGuideStore((s) => s.recalculateScore)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color.configure({ types: [TextStyle.name] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Commencez a rediger votre contenu ici...' }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const text = editor.getText()

      setContent(json)
      setPlainText(text)

      // Debounce scoring recalculation
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        recalculateScore(text, json as Record<string, unknown>)
      }, 500)
    },
  })

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-auto p-6">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none min-h-full focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[500px]"
        />
      </div>
    </div>
  )
}
