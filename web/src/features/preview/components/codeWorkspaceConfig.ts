import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { CodeFile, CodeFilePath, CodeFileTreeNode } from '@/features/preview/types'

const VSCODE_DARK_PLUS_BACKGROUND = '#1e1e1e'
const VSCODE_DARK_PLUS_TEXT = '#d4d4d4'
const VSCODE_DARK_PLUS_ACTIVE_LINE = '#2a2d2e'
const VSCODE_DARK_PLUS_SELECTION = '#264f78'
const VSCODE_DARK_PLUS_GUTTER_TEXT = '#858585'

const createFileNode = (
    path: CodeFilePath,
    label: string,
    language: CodeFile['language']
): CodeFileTreeNode => ({
    type: 'file',
    file: {
        path,
        label,
        language,
    },
})

const createFolderNode = (
    name: string,
    path: string,
    children: CodeFileTreeNode[]
): CodeFileTreeNode => ({
    type: 'folder',
    name,
    path,
    children,
})

export const SAMPLE_REACT_PROJECT_TREE: CodeFileTreeNode[] = [
    createFileNode('package.json', 'package.json', 'javascript'),
    createFileNode('tsconfig.json', 'tsconfig.json', 'javascript'),
    createFileNode('vite.config.ts', 'vite.config.ts', 'typescript'),
    createFolderNode('public', 'public', [
        createFileNode('public/index.html', 'index.html', 'html'),
    ]),
    createFolderNode('src', 'src', [
        createFileNode('src/main.tsx', 'main.tsx', 'tsx'),
        createFileNode('src/App.tsx', 'App.tsx', 'tsx'),
        createFileNode('src/App.css', 'App.css', 'css'),
        createFolderNode('components', 'src/components', [
            createFileNode('src/components/Header.tsx', 'Header.tsx', 'tsx'),
            createFileNode('src/components/FileExplorer.tsx', 'FileExplorer.tsx', 'tsx'),
            createFileNode('src/components/EditorPane.tsx', 'EditorPane.tsx', 'tsx'),
        ]),
        createFolderNode('hooks', 'src/hooks', [
            createFileNode('src/hooks/useProjectFiles.ts', 'useProjectFiles.ts', 'typescript'),
        ]),
        createFolderNode('utils', 'src/utils', [
            createFileNode('src/utils/tree.ts', 'tree.ts', 'typescript'),
        ]),
        createFolderNode('features', 'src/features', [
            createFolderNode('preview', 'src/features/preview', [
                createFileNode('src/features/preview/PreviewPanel.tsx', 'PreviewPanel.tsx', 'tsx'),
                createFileNode('src/features/preview/PreviewPanel.css', 'PreviewPanel.css', 'css'),
            ]),
        ]),
    ]),
]

const flattenFiles = (nodes: CodeFileTreeNode[]): CodeFile[] =>
    nodes.flatMap((node) => {
        if (node.type === 'file') {
            return [node.file]
        }

        return flattenFiles(node.children)
    })

export const SAMPLE_REACT_PROJECT_FILES = flattenFiles(SAMPLE_REACT_PROJECT_TREE)

export const DEFAULT_CODE_FILE_PATH: CodeFilePath =
    SAMPLE_REACT_PROJECT_FILES.find((file) => file.path === 'src/App.tsx')?.path ??
    SAMPLE_REACT_PROJECT_FILES[0]?.path ??
    'src/App.tsx'

const DEFAULT_PUBLIC_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Phase IDE Sample</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`

const REACT_SAMPLE_CONTENTS: Record<CodeFilePath, string> = {
    'package.json': `{
  "name": "phase-react-sample",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}`,
    'vite.config.ts': `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
  },
})`,
    'public/index.html': DEFAULT_PUBLIC_INDEX_HTML,
    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
    'src/App.tsx': `import { Header } from './components/Header'
import { PreviewPanel } from './features/preview/PreviewPanel'

export default function App() {
  return (
    <main className="app-shell">
      <Header title="Phase IDE" subtitle="React sample project" />
      <PreviewPanel />
    </main>
  )
}`,
    'src/App.css': `.app-shell {
  min-height: 100vh;
  background: #0f1116;
  color: #e5e7eb;
  padding: 24px;
  font-family: 'Inter', sans-serif;
}`,
    'src/components/Header.tsx': `interface HeaderProps {
  title: string
  subtitle: string
}

export const Header = ({ title, subtitle }: HeaderProps) => {
  return (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  )
}`,
    'src/components/FileExplorer.tsx': `export const FileExplorer = () => {
  return <aside>VS Code style file explorer tree</aside>
}`,
    'src/components/EditorPane.tsx': `export const EditorPane = () => {
  return <section>Code editor pane</section>
}`,
    'src/hooks/useProjectFiles.ts': `export const useProjectFiles = () => {
  return {
    selected: 'src/App.tsx',
  }
}`,
    'src/utils/tree.ts': `export const flattenTree = <T>(items: T[]): T[] => {
  return items
}`,
    'src/features/preview/PreviewPanel.tsx': `import './PreviewPanel.css'

export const PreviewPanel = () => {
  return (
    <section className="preview-panel">
      <h2>Preview</h2>
      <p>Switch to Preview tab to run your generated output.</p>
    </section>
  )
}`,
    'src/features/preview/PreviewPanel.css': `.preview-panel {
  margin-top: 20px;
  border: 1px solid #2a2d2e;
  background: #161b22;
  border-radius: 10px;
  padding: 16px;
}`,
}

export const getSampleReactProjectContents = (html: string): Record<CodeFilePath, string> => ({
    ...REACT_SAMPLE_CONTENTS,
    'public/index.html': html.trim() ? html : DEFAULT_PUBLIC_INDEX_HTML,
})

export const vscodeDarkPlusTheme = EditorView.theme(
    {
        '&': {
            height: '100%',
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            color: VSCODE_DARK_PLUS_TEXT,
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: '14px',
        },

        '.cm-scroller': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            lineHeight: '1.5',
            overflow: 'auto',
        },

        '.cm-content': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            padding: '8px 0',
            caretColor: '#ffffff',
        },

        '.cm-line': {
            paddingLeft: '4px',
        },

        '.cm-gutters': {
            backgroundColor: VSCODE_DARK_PLUS_BACKGROUND,
            color: VSCODE_DARK_PLUS_GUTTER_TEXT,
            border: 'none',
            minWidth: '42px',
        },

        '.cm-gutterElement': {
            padding: '0 10px 0 12px',
        },

        '.cm-lineNumbers .cm-gutterElement': {
            textAlign: 'right',
        },

        '.cm-activeLine': {
            backgroundColor: VSCODE_DARK_PLUS_ACTIVE_LINE,
        },

        '.cm-activeLineGutter': {
            backgroundColor: VSCODE_DARK_PLUS_ACTIVE_LINE,
            color: VSCODE_DARK_PLUS_TEXT,
        },

        '.cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: `${VSCODE_DARK_PLUS_SELECTION} !important`,
        },

        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: '#ffffff',
        },
    },
    { dark: true }
)

export const vscodeDarkPlusHighlightStyle = HighlightStyle.define([
    {
        tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.modifier],
        color: '#569CD6',
    },
    { tag: [tags.string, tags.special(tags.string)], color: '#CE9178' },
    { tag: [tags.number, tags.bool, tags.null], color: '#B5CEA8' },
    { tag: tags.comment, color: '#6A9955', fontStyle: 'italic' },
    { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: '#9CDCFE' },
    {
        tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName],
        color: '#DCDCAA',
    },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#4EC9B0' },
    { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: '#D4D4D4' },
])

export const vscodeDarkPlusExtensions: Extension[] = [
    vscodeDarkPlusTheme,
    syntaxHighlighting(vscodeDarkPlusHighlightStyle),
]

export const getSharedEditorExtensions = (): Extension[] => [
    EditorState.tabSize.of(2),
    EditorState.allowMultipleSelections.of(true),
    indentUnit.of('  '),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
        spellcheck: 'false',
        'data-gramm': 'false',
    }),
    keymap.of([indentWithTab]),
    ...vscodeDarkPlusExtensions,
]

export const getLanguageExtension = (language: CodeFile['language']): Extension => {
    if (language === 'html') return htmlLanguage()
    if (language === 'css') return cssLanguage()
    if (language === 'typescript') return javascript({ typescript: true })
    if (language === 'tsx') return javascript({ typescript: true, jsx: true })
    return javascript({ jsx: true })
}

export const codeMirrorBasicSetup = {
    autocompletion: true,
    bracketMatching: true,
    closeBrackets: true,
    defaultKeymap: true,
    drawSelection: true,
    foldGutter: true,
    foldKeymap: true,
    highlightActiveLine: true,
    highlightActiveLineGutter: true,
    highlightSelectionMatches: true,
    history: true,
    historyKeymap: true,
    indentOnInput: true,
    lineNumbers: true,
    rectangularSelection: true,
    searchKeymap: true,
    syntaxHighlighting: true,
}
