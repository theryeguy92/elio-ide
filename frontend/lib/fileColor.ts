/**
 * File icon accent — gold for Python (first-class in Elio), muted greys
 * otherwise. Shared by the sidebar tree and editor tab icons.
 */
export function fileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'py') return 'text-elio-primary'
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx':
    case 'json': case 'md': case 'css': case 'html':
    case 'yaml': case 'yml': case 'toml': case 'sh': case 'sql':
      return 'text-elio-text-muted'
    default:
      return 'text-elio-text-dim'
  }
}
