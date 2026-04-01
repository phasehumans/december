import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type {
    CodeFile,
    CodeFileLanguage,
    CodeFilePath,
    CodeFileTreeNode,
} from '@/features/preview/types'

const VSCODE_DARK_PLUS_BACKGROUND = '#1e1e1e'
const VSCODE_DARK_PLUS_TEXT = '#d4d4d4'
const VSCODE_DARK_PLUS_ACTIVE_LINE = '#2a2d2e'
const VSCODE_DARK_PLUS_SELECTION = '#264f78'
const VSCODE_DARK_PLUS_GUTTER_TEXT = '#858585'

interface MutableFolderNode {
    name: string
    path: string
    folders: Map<string, MutableFolderNode>
    files: CodeFile[]
}

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

const getFileLabel = (path: CodeFilePath) => path.split('/').pop() ?? path

export const inferCodeFileLanguage = (path: CodeFilePath): CodeFileLanguage => {
    if (path.endsWith('.html')) return 'html'
    if (path.endsWith('.css')) return 'css'
    if (path.endsWith('.tsx')) return 'tsx'
    if (path.endsWith('.ts')) return 'typescript'
    return 'javascript'
}

const sortTreeNodes = (a: CodeFileTreeNode, b: CodeFileTreeNode) => {
    if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
    }

    const aLabel = a.type === 'folder' ? a.name : a.file.label
    const bLabel = b.type === 'folder' ? b.name : b.file.label

    return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' })
}

const toTreeNodes = (folder: MutableFolderNode): CodeFileTreeNode[] => {
    const folderNodes = [...folder.folders.values()].map((childFolder) =>
        createFolderNode(childFolder.name, childFolder.path, toTreeNodes(childFolder))
    )
    const fileNodes = folder.files.map((file) =>
        createFileNode(file.path, file.label, file.language)
    )

    return [...folderNodes, ...fileNodes].sort(sortTreeNodes)
}

export const createCodeWorkspaceTree = (paths: CodeFilePath[]): CodeFileTreeNode[] => {
    const root: MutableFolderNode = {
        name: '',
        path: '',
        folders: new Map(),
        files: [],
    }

    const normalizedPaths = [...new Set(paths)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
    )

    for (const path of normalizedPaths) {
        const segments = path.split('/').filter(Boolean)

        if (segments.length === 0) {
            continue
        }

        let currentFolder = root

        for (let index = 0; index < segments.length - 1; index += 1) {
            const segment = segments[index]!
            const nextPath = segments.slice(0, index + 1).join('/')
            const existingFolder = currentFolder.folders.get(segment)

            if (existingFolder) {
                currentFolder = existingFolder
                continue
            }

            const nextFolder: MutableFolderNode = {
                name: segment,
                path: nextPath,
                folders: new Map(),
                files: [],
            }

            currentFolder.folders.set(segment, nextFolder)
            currentFolder = nextFolder
        }

        currentFolder.files.push({
            path,
            label: getFileLabel(path),
            language: inferCodeFileLanguage(path),
        })
    }

    return toTreeNodes(root)
}

export const flattenFiles = (nodes: CodeFileTreeNode[]): CodeFile[] =>
    nodes.flatMap((node) => {
        if (node.type === 'file') {
            return [node.file]
        }

        return flattenFiles(node.children)
    })

const DEFAULT_FILE_PATH_PRIORITIES = [
    'src/App.tsx',
    'web/src/App.tsx',
    'src/main.tsx',
    'web/src/main.tsx',
    'index.html',
    'public/index.html',
    'web/index.html',
]

export const getDefaultCodeFilePath = (paths: CodeFilePath[]): CodeFilePath | null => {
    for (const preferredPath of DEFAULT_FILE_PATH_PRIORITIES) {
        if (paths.includes(preferredPath)) {
            return preferredPath
        }
    }

    const sortedPaths = [...paths].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
    )

    return sortedPaths[0] ?? null
}

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
    vscodeDarkPlusTheme,
    syntaxHighlighting(vscodeDarkPlusHighlightStyle),
]

export const getLanguageExtension = (language: CodeFile['language']): Extension => {
    if (language === 'html') return htmlLanguage()
    if (language === 'css') return cssLanguage()
    if (language === 'typescript') return javascript({ typescript: true })
    if (language === 'tsx') return javascript({ typescript: true, jsx: true })
    return javascript({ jsx: true })
}

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
