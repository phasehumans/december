import React from 'react'
import Editor from '@monaco-editor/react'
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

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ html, onHtmlChange }) => {
    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>('index.html')
    const [files, setFiles] = React.useState<Record<CodeFilePath, string>>(() =>
        extractFilesFromHtml(html)
    )

    React.useEffect(() => {
        setFiles(extractFilesFromHtml(html))
    }, [html])

    const activeFile = FILES.find((file) => file.path === selectedFile) ?? FILES[0]

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
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#111318] border-t border-white/5">
            <aside className="w-56 shrink-0 border-r border-white/10 bg-[#0D0F14] flex flex-col">
                <div className="h-10 px-4 flex items-center text-[11px] tracking-[0.12em] uppercase text-[#6D7180] border-b border-white/10">
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
                                    ? 'bg-[#1C2230] text-white'
                                    : 'text-[#9AA1B2] hover:text-white hover:bg-white/5'
                            )}
                        >
                            <FileCode2 size={14} className="shrink-0" />
                            <span className="truncate">{file.label}</span>
                        </button>
                    ))}
                </div>
            </aside>

            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="h-10 shrink-0 px-4 flex items-center text-xs text-[#9AA1B2] border-b border-white/10 bg-[#141824]">
                    {activeFile.label}
                </div>
                <div className="flex-1 min-h-0">
                    <Editor
                        path={activeFile.path}
                        language={activeFile.language}
                        theme="vs-dark"
                        value={files[activeFile.path]}
                        onChange={(value) => handleChange(value ?? '')}
                        loading={<div className="h-full w-full bg-[#0B0D12]" />}
                        options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineHeight: 20,
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            tabSize: 2,
                            insertSpaces: true,
                            padding: { top: 12 },
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
