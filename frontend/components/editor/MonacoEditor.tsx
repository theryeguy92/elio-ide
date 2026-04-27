'use client'

import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { X, FileCode } from 'lucide-react'
import { useCodeJump } from '@/context/CodeJumpContext'
import { useEditor } from '@/context/EditorContext'

// ---------------------------------------------------------------------------
// Language icons color
// ---------------------------------------------------------------------------

function TabIcon({ language }: { language: string }) {
  const color =
    language === 'python' ? 'text-yellow-400' :
    language === 'typescript' ? 'text-blue-400' :
    language === 'javascript' ? 'text-yellow-300' :
    language === 'json' ? 'text-green-400' :
    'text-gray-400'
  return <FileCode className={`h-3.5 w-3.5 shrink-0 ${color}`} />
}

// ---------------------------------------------------------------------------
// MonacoEditor
// ---------------------------------------------------------------------------

export default function MonacoEditor() {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const modelsRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map())

  const { jumpRequest } = useCodeJump()
  const {
    tabs,
    activeTab,
    openFile,
    closeTab,
    markDirty,
    saveActive,
    registerGetContent,
    registerSwitchModel,
  } = useEditor()

  // Register bridge callbacks on mount
  useEffect(() => {
    registerGetContent(() => editorRef.current?.getValue() ?? '')
    registerSwitchModel((path, content, language) => {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco) return

      let model = modelsRef.current.get(path)
      if (!model) {
        model = monaco.editor.createModel(content, language, monaco.Uri.parse(`file:///${path}`))
        modelsRef.current.set(path, model)

        model.onDidChangeContent(() => {
          markDirty(path, true)
        })
      }
      editor.setModel(model)
      editor.focus()
    })

    return () => {
      registerGetContent(null)
      registerSwitchModel(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveActive()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveActive])

  // Trace jump highlight
  useEffect(() => {
    if (!jumpRequest || !editorRef.current || !monacoRef.current) return
    const editor = editorRef.current
    const monaco = monacoRef.current
    const { line } = jumpRequest

    editor.revealLineInCenter(line)

    const collection = editor.createDecorationsCollection([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'trace-jump-highlight' },
      },
    ])

    const timer = setTimeout(() => collection.clear(), 3000)
    return () => {
      clearTimeout(timer)
      collection.clear()
    }
  }, [jumpRequest])

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Add save command inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveActive()
    })

    editor.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-end border-b border-[#3c3c3c] bg-[#252526] shrink-0 overflow-x-auto">
        {tabs.length === 0 ? (
          <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-gray-500">
            No file open — click a file in the explorer
          </div>
        ) : (
          tabs.map((tab) => {
            const fileName = tab.path.split('/').pop() ?? tab.path
            const isActive = tab.path === activeTab
            return (
              <div
                key={tab.path}
                className={`group flex items-center gap-1.5 px-3 py-1.5 border-r border-[#3c3c3c] cursor-pointer shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#1e1e1e] border-t-2 border-t-blue-500'
                    : 'bg-[#2d2d2d] border-t-2 border-t-transparent hover:bg-[#2a2d2e]'
                }`}
                onClick={() => openFile(tab.path)}
              >
                <TabIcon language={tab.language} />
                <span className={`text-xs whitespace-nowrap ${isActive ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-200'}`}>
                  {fileName}{tab.isDirty ? ' ●' : ''}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
                  className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] transition-opacity"
                  aria-label={`Close ${fileName}`}
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {tabs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-600">
            <FileCode className="h-12 w-12 opacity-30" />
            <p className="text-sm">Open a file from the Explorer</p>
          </div>
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
              fontFamily:
                '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
              fontLigatures: true,
              padding: { top: 16, bottom: 16 },
            }}
          />
        )}
      </div>
    </div>
  )
}
