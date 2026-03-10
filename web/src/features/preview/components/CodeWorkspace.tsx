import React from 'react'
import { CodeWorkspaceEditorPane } from './CodeWorkspaceEditorPane'
import { CodeWorkspaceFileSidebar } from './CodeWorkspaceFileSidebar'
import {
    FILES,
    applyScriptToHtml,
    applyStylesToHtml,
    extractFilesFromHtml,
    getLanguageExtension,
    getSharedEditorExtensions,
} from './codeWorkspaceConfig'
import type { CodeFile, CodeFilePath, CodeWorkspaceProps } from '@/features/preview/types'

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ html, onHtmlChange }) => {
    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>('index.html')
    const [files, setFiles] = React.useState<Record<CodeFilePath, string>>(() =>
        extractFilesFromHtml(html)
    )

    React.useEffect(() => {
        setFiles(extractFilesFromHtml(html))
    }, [html])

    const activeFile: CodeFile = FILES.find((file) => file.path === selectedFile) ??
        FILES[0] ?? { path: 'index.html', label: 'index.html', language: 'html' }

    const sharedExtensions = React.useMemo(() => getSharedEditorExtensions(), [])

    const editorExtensions = React.useMemo(
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
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#1e1e1e] border-t border-[#2d2d2d]">
            <CodeWorkspaceFileSidebar
                files={FILES}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
            />

            <CodeWorkspaceEditorPane
                activeFile={activeFile}
                value={files[activeFile.path]}
                extensions={editorExtensions}
                onChange={handleChange}
            />
        </div>
    )
}
