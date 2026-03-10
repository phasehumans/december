import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css as cssLanguage } from '@codemirror/lang-css'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { FileCode2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CodeFile, CodeFilePath, CodeWorkspaceProps } from '@/features/preview/types'

const FILES: CodeFile[] = [
    { path: 'index.html', label: 'index.html', language: 'html' },
    { path: 'styles.css', label: 'styles.css', language: 'css' },
    { path: 'script.js', label: 'script.js', language: 'javascript' },
]

const STYLE_BLOCK_REGEX = /<style\b[^>]*>([\s\S]*?)<\/style>/i
const INLINE_SCRIPT_REGEX = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i

const normalizeBlock = (block: string) => block.replace(/^\n+|\n+$/g, '')

const extractFilesFromHtml = (html: string): Record<CodeFilePath, string> => {
    const styleMatch = html.match(STYLE_BLOCK_REGEX)
    const scriptMatch = html.match(INLINE_SCRIPT_REGEX)

    return {
        'index.html': html,
        'styles.css': styleMatch?.[1] ? normalizeBlock(styleMatch[1]) : '',
        'script.js': scriptMatch?.[1] ? normalizeBlock(scriptMatch[1]) : '',
    }
}

const applyStylesToHtml = (html: string, styles: string) => {
    const styleBlock = `<style>\n${styles}\n    </style>`

    if (STYLE_BLOCK_REGEX.test(html)) {
        return html.replace(STYLE_BLOCK_REGEX, styleBlock)
    }

    if (html.includes('</head>')) {
        return html.replace('</head>', `    ${styleBlock}\n</head>`)
    }

    return `${styleBlock}\n${html}`
}

const applyScriptToHtml = (html: string, script: string) => {
    const scriptBlock = `<script>\n${script}\n    </script>`

    if (INLINE_SCRIPT_REGEX.test(html)) {
        return html.replace(INLINE_SCRIPT_REGEX, scriptBlock)
    }

    if (html.includes('</body>')) {
        return html.replace('</body>', `    ${scriptBlock}\n</body>`)
    }

    return `${html}\n${scriptBlock}`
}

const codeMirrorTheme = EditorView.theme(
    {
        '&': {
            height: '100%',
            backgroundColor: '#171615',
            color: '#E8E8E6',
            fontSize: '13px',
        },
        '.cm-scroller': {
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: '20px',
            overflow: 'auto',
        },
        '.cm-content': {
            padding: '12px 0 16px',
        },
        '.cm-gutters': {
            backgroundColor: '#1D1C1B',
            color: '#A09F9D',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
        '.cm-activeLine': {
            backgroundColor: '#252423',
        },
        '.cm-activeLineGutter': {
            backgroundColor: '#252423',
            color: '#E8E8E6',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: '#3A3837 !important',
        },
        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: '#FFFFFF',
        },
        '.cm-foldPlaceholder': {
            backgroundColor: '#252423',
            borderColor: '#333333',
            color: '#A09F9D',
        },
        '.cm-tooltip': {
            backgroundColor: '#1D1C1B',
            color: '#E8E8E6',
            border: '1px solid #333333',
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: '#252423',
            color: '#FFFFFF',
        },
        '.cm-searchMatch': {
            backgroundColor: '#5D4F2B',
            outline: '1px solid #A58E49',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
            backgroundColor: '#7A6734',
        },
    },
    { dark: true }
)

const codeMirrorHighlightStyle = HighlightStyle.define([
    { tag: [tags.comment, tags.meta], color: '#8A867E' },
    {
        tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword, tags.modifier],
        color: '#E0A458',
    },
    { tag: [tags.string, tags.special(tags.string)], color: '#8FCB9B' },
    { tag: [tags.number, tags.bool, tags.null], color: '#D788A4' },
    { tag: [tags.tagName, tags.className, tags.typeName], color: '#89B4FA' },
    { tag: [tags.attributeName, tags.propertyName], color: '#E7B97E' },
    { tag: [tags.function(tags.variableName), tags.labelName], color: '#8EC7FF' },
    { tag: [tags.variableName, tags.name], color: '#E8E8E6' },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#CFC9BD' },
    { tag: tags.invalid, color: '#FF6B6B' },
])

const getLanguageExtension = (language: CodeFile['language']): Extension => {
    if (language === 'html') {
        return htmlLanguage()
    }

    if (language === 'css') {
        return cssLanguage()
    }

    return javascript()
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ html, onHtmlChange }) => {
    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>('index.html')
    const [files, setFiles] = React.useState<Record<CodeFilePath, string>>(() =>
        extractFilesFromHtml(html)
    )

    React.useEffect(() => {
        setFiles(extractFilesFromHtml(html))
    }, [html])

    const activeFile: CodeFile =
        FILES.find((file) => file.path === selectedFile) ??
        FILES[0] ??
        { path: 'index.html', label: 'index.html', language: 'html' }

    const sharedExtensions = React.useMemo<Extension[]>(
        () => [
            EditorState.tabSize.of(2),
            indentUnit.of('  '),
            EditorView.lineWrapping,
            keymap.of([indentWithTab]),
            codeMirrorTheme,
            syntaxHighlighting(codeMirrorHighlightStyle),
        ],
        []
    )

    const editorExtensions = React.useMemo<Extension[]>(
        () => [...sharedExtensions, getLanguageExtension(activeFile.language)],
        [activeFile.language, sharedExtensions]
    )

    const handleChange = (value: string) => {
        if (activeFile.path === 'index.html') {
            const nextFiles = extractFilesFromHtml(value)
            setFiles(nextFiles)
            onHtmlChange?.(nextFiles['index.html'])
            return
        }

        if (activeFile.path === 'styles.css') {
            const nextHtml = applyStylesToHtml(files['index.html'], value)
            setFiles((prev) => ({
                ...prev,
                'index.html': nextHtml,
                'styles.css': value,
            }))
            onHtmlChange?.(nextHtml)
            return
        }

        const nextHtml = applyScriptToHtml(files['index.html'], value)
        setFiles((prev) => ({
            ...prev,
            'index.html': nextHtml,
            'script.js': value,
        }))
        onHtmlChange?.(nextHtml)
    }

    return (
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#171615] border-t border-white/5">
            <aside className="w-56 shrink-0 border-r border-white/10 bg-[#1D1C1B] flex flex-col">
                <div className="h-10 px-4 flex items-center text-[11px] tracking-[0.12em] uppercase text-[#A09F9D] border-b border-white/10">
                    Files
                </div>
                <div className="p-2 space-y-1 overflow-auto">
                    {FILES.map((file) => (
                        <button
                            key={file.path}
                            onClick={() => setSelectedFile(file.path)}
                            className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition-colors',
                                selectedFile === file.path
                                    ? 'bg-[#252423] text-white'
                                    : 'text-[#A09F9D] hover:text-white hover:bg-white/5'
                            )}
                        >
                            <FileCode2 size={14} className="shrink-0" />
                            <span className="truncate">{file.label}</span>
                        </button>
                    ))}
                </div>
            </aside>

            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="h-10 shrink-0 px-4 flex items-center text-xs text-[#A09F9D] border-b border-white/10 bg-[#1D1C1B]">
                    {activeFile.label}
                </div>
                <div className="flex-1 min-h-0">
                    <CodeMirror
                        key={activeFile.path}
                        value={files[activeFile.path]}
                        height="100%"
                        className="h-full"
                        extensions={editorExtensions}
                        basicSetup={{
                            autocompletion: true,
                            bracketMatching: true,
                            closeBrackets: true,
                            drawSelection: true,
                            foldGutter: true,
                            highlightActiveLine: true,
                            highlightActiveLineGutter: true,
                            history: true,
                            indentOnInput: true,
                            lineNumbers: true,
                            rectangularSelection: true,
                            searchKeymap: true,
                            syntaxHighlighting: true,
                        }}
                        onChange={(value) => handleChange(value)}
                    />
                </div>
            </div>
        </div>
    )
}

