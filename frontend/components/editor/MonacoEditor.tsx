'use client'

import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { X, FileCode } from 'lucide-react'
import { useCodeJump } from '@/context/CodeJumpContext'
import { useEditor } from '@/context/EditorContext'

function TabIcon({ language }: { language: string }) {
  const color =
    language === 'python'     ? 'text-[#F5A623]' :
    language === 'typescript' ? 'text-blue-400' :
    language === 'javascript' ? 'text-yellow-300' :
    language === 'json'       ? 'text-green-400' :
    'text-elio-text-dim'
  return <FileCode className={`h-3.5 w-3.5 shrink-0 ${color}`} />
}

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
        model.onDidChangeContent(() => markDirty(path, true))
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
    return () => { clearTimeout(timer); collection.clear() }
  }, [jumpRequest])

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveActive())
    editor.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full flex flex-col bg-elio-bg">
      {/* Tab bar */}
      <div className="flex items-end bg-elio-surface border-b border-elio-border shrink-0 overflow-x-auto">
        {tabs.length === 0 ? (
          <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-elio-text-dim">
            Open a file from the Explorer
          </div>
        ) : (
          tabs.map((tab) => {
            const fileName = tab.path.split('/').pop() ?? tab.path
            const isActive = tab.path === activeTab
            return (
              <div
                key={tab.path}
                className={`group flex items-center gap-1.5 px-3 py-2 border-r border-elio-border cursor-pointer shrink-0 transition-colors duration-150 ${
                  isActive
                    ? 'bg-elio-bg text-elio-text border-b-2 border-b-elio-primary'
                    : 'bg-elio-surface text-elio-text-muted hover:bg-elio-surface-2 hover:text-elio-text border-b-2 border-b-transparent'
                }`}
                onClick={() => openFile(tab.path)}
              >
                <TabIcon language={tab.language} />
                <span className="text-[11px] whitespace-nowrap font-mono">
                  {fileName}
                  {tab.isDirty && <span className="ml-1 text-elio-primary">●</span>}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
                  className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-elio-surface-3 transition-opacity duration-150"
                  aria-label={`Close ${fileName}`}
                >
                  <X className="h-3 w-3 text-elio-text-muted" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {tabs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-elio-text-dim">
            <FileCode className="h-12 w-12 opacity-20" />
            <p className="text-[11px]">Open a file from the Explorer</p>
          </div>
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: 'on',
              fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
              fontLigatures: true,
              padding: { top: 16, bottom: 16 },
              lineNumbersMinChars: 3,
              glyphMargin: false,
              folding: true,
              cursorBlinking: 'smooth',
            }}
          />
        )}
      </div>
    </div>
  )
}
