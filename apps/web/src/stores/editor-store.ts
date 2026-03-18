import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'

interface EditorState {
  content: JSONContent
  plainText: string
  setContent: (content: JSONContent) => void
  setPlainText: (text: string) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  content: {},
  plainText: '',
  setContent: (content) => set({ content }),
  setPlainText: (plainText) => set({ plainText }),
}))
