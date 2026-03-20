import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

const CUSTOM_THEME = EditorView.theme({
  '&': {
    backgroundColor: '#0a0e1a !important',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", monospace', lineHeight: '1.7' },
  '.cm-content': { padding: '16px' },
  '.cm-gutters': { backgroundColor: '#0f1629 !important', borderRight: '1px solid #1e2d4a', color: '#334155' },
  '.cm-activeLineGutter': { backgroundColor: '#141c35 !important' },
  '.cm-activeLine': { backgroundColor: '#141c35 !important' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(59,130,246,0.25) !important' },
  '.cm-cursor': { borderLeftColor: '#3b82f6' },
})

interface Props {
  value: string
  onChange: (v: string) => void
  language?: string
  readOnly?: boolean
}

function getExtensions(language: string) {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx':
      return [javascript({ typescript: true })]
    case 'python':
    default:
      return [python()]
  }
}

export function CodeEditor({ value, onChange, language = 'python', readOnly = false }: Props) {
  return (
    <div className="h-full overflow-hidden" style={{ background: '#0a0e1a' }}>
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={[...getExtensions(language), CUSTOM_THEME]}
        onChange={onChange}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightActiveLine: true,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  )
}
