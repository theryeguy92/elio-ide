'use client'

import { useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group/code mb-2 rounded border border-elio-border bg-elio-bg">
      <div className="flex items-center justify-between px-2 py-1 border-b border-elio-border">
        <span className="text-[9px] uppercase tracking-widest text-elio-text-dim">{language || 'code'}</span>
        <button
          onClick={copy}
          className="p-0.5 rounded opacity-0 group-hover/code:opacity-100 hover:bg-elio-surface-2 transition-opacity duration-150"
          aria-label="Copy code"
        >
          {copied
            ? <Check className="h-3 w-3 text-elio-success" />
            : <Copy className="h-3 w-3 text-elio-text-dim" />}
        </button>
      </div>
      <pre className="p-2 overflow-x-auto text-[10px] leading-relaxed text-elio-text">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-[13px] font-bold text-elio-text mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-bold text-elio-text mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[11px] font-semibold text-elio-text mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="marker:text-elio-text-dim">{children}</li>,
  strong: ({ children }) => <strong className="text-elio-text font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-elio-primary hover:underline">{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-elio-primary/50 pl-2 mb-2 text-elio-text-dim">{children}</blockquote>
  ),
  hr: () => <hr className="border-elio-border my-2" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-[10px] border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-elio-border px-2 py-1 bg-elio-surface-3 text-elio-text text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-elio-border px-2 py-1 align-top">{children}</td>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? '')
    const code = String(children).replace(/\n$/, '')
    if (match || code.includes('\n')) {
      return <CodeBlock language={match?.[1] ?? ''} code={code} />
    }
    return (
      <code className="bg-elio-surface-3 text-elio-primary px-1 py-0.5 rounded text-[10px] font-mono">
        {code}
      </code>
    )
  },
}

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="text-[11px] text-elio-text-muted leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
