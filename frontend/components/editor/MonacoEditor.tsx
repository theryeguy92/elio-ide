'use client'

import { useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'

const defaultValue = `import anthropic

client = anthropic.Anthropic()


def run_agent(task: str) -> str:
    """Run an AI agent to complete the given task."""
    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": task}],
    )
    return message.content[0].text


if __name__ == "__main__":
    result = run_agent("Analyze the dataset and generate insights")
    print(result)
`

export default function MonacoEditor() {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.focus()
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="python"
      defaultValue={defaultValue}
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
  )
}
