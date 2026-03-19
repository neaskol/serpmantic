import { create } from 'zustand'
import type { JSONContent, Editor } from '@tiptap/react'

interface EditorState {
  content: JSONContent
  plainText: string
  editor: Editor | null
  setContent: (content: JSONContent) => void
  setPlainText: (text: string) => void
  setEditor: (editor: Editor | null) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  content: {},
  plainText: '',
  editor: null,
  setContent: (content) => set({ content }),
  setPlainText: (plainText) => set({ plainText }),
  setEditor: (editor) => set({ editor }),
}))
