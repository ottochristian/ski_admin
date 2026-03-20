'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RichTextEditorHandle {
  insertText: (text: string) => void
  focus: () => void
}

interface RichTextEditorProps {
  value: string // HTML string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
  minHeight?: string
}

function isEmpty(html: string): boolean {
  return !html || html === '<p></p>' || html === '<p><br></p>'
}

export function isRichTextEmpty(html: string): boolean {
  return isEmpty(html)
}

// Convert plain text (with newlines) to HTML paragraphs
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  return text
    .split(/\n\n+/)
    .map(para => {
      const lines = para.split('\n').map(l =>
        l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      )
      return `<p>${lines.join('<br>')}</p>`
    })
    .join('')
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      onChange,
      placeholder = 'Type your message here…',
      readOnly = false,
      className,
      minHeight = '200px',
    },
    ref
  ) {
    const isUpdatingFromProp = useRef(false)

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            class: 'text-orange-400 underline',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: value || '',
      editable: !readOnly,
      onUpdate({ editor }) {
        if (isUpdatingFromProp.current) return
        const html = editor.getHTML()
        onChange(isEmpty(html) ? '' : html)
      },
    })

    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        editor?.chain().focus().insertContent(text).run()
      },
      focus() {
        editor?.commands.focus()
      },
    }))

    // Sync external value changes
    useEffect(() => {
      if (!editor) return
      const current = editor.getHTML()
      if (value === current) return
      if (isEmpty(value) && isEmpty(current)) return

      isUpdatingFromProp.current = true
      editor.commands.setContent(value || '')
      isUpdatingFromProp.current = false
    }, [value, editor])

    useEffect(() => {
      if (!editor) return
      editor.setEditable(!readOnly)
    }, [readOnly, editor])

    function setLink() {
      if (!editor) return
      const prev = editor.getAttributes('link').href as string | undefined
      const url = window.prompt('Link URL:', prev ?? 'https://')
      if (url === null) return
      if (!url.trim()) {
        editor.chain().focus().unsetLink().run()
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
    }

    if (!editor) return null

    const btnBase = 'p-1.5 rounded transition-colors'
    const btnActive = 'bg-zinc-700 text-white'
    const btnInactive = 'text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'

    return (
      <div
        className={cn(
          'rounded-lg border border-zinc-700 bg-zinc-900 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 transition-colors overflow-hidden',
          className
        )}
      >
        {/* Toolbar */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-700/60 bg-zinc-900">
            <button
              type="button"
              title="Bold (⌘B)"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
              className={cn(btnBase, editor.isActive('bold') ? btnActive : btnInactive)}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Italic (⌘I)"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
              className={cn(btnBase, editor.isActive('italic') ? btnActive : btnInactive)}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Underline (⌘U)"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
              className={cn(btnBase, editor.isActive('underline') ? btnActive : btnInactive)}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1" />
            <button
              type="button"
              title="Add link"
              onMouseDown={e => { e.preventDefault(); setLink() }}
              className={cn(btnBase, editor.isActive('link') ? btnActive : btnInactive)}
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
            {editor.isActive('link') && (
              <button
                type="button"
                title="Remove link"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetLink().run() }}
                className={cn(btnBase, btnInactive)}
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Editor area */}
        <EditorContent
          editor={editor}
          className="px-3 py-2.5 text-sm text-foreground [&_.tiptap]:outline-none [&_.tiptap_p]:my-1"
          style={{ minHeight }}
        />
        <style>{`
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #52525b;
            pointer-events: none;
            height: 0;
          }
        `}</style>
      </div>
    )
  }
)
