import React from 'react'
import { CodeWorkspaceEditorPane } from './CodeWorkspaceEditorPane'
import { CodeWorkspaceFileSidebar } from './CodeWorkspaceFileSidebar'
import {
    DEFAULT_CODE_FILE_PATH,
    SAMPLE_REACT_PROJECT_FILES,
    SAMPLE_REACT_PROJECT_TREE,
    getLanguageExtension,
    getSampleReactProjectContents,
    getSharedEditorExtensions,
} from './codeWorkspaceConfig'
import type { CodeFile, CodeFilePath, CodeWorkspaceProps } from '@/features/preview/types'

const FALLBACK_FILE: CodeFile = {
    path: DEFAULT_CODE_FILE_PATH,
    label: 'App.tsx',
    language: 'tsx',
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ html, onHtmlChange }) => {
    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>(DEFAULT_CODE_FILE_PATH)
    const [openFilePaths, setOpenFilePaths] = React.useState<CodeFilePath[]>([DEFAULT_CODE_FILE_PATH])
    const [files, setFiles] = React.useState<Record<CodeFilePath, string>>(() =>
        getSampleReactProjectContents(html)
    )

    React.useEffect(() => {
        setFiles((previous) => ({
            ...previous,
            'public/index.html': html,
        }))
    }, [html])

    const activeFile: CodeFile =
        SAMPLE_REACT_PROJECT_FILES.find((file) => file.path === selectedFile) ??
        SAMPLE_REACT_PROJECT_FILES[0] ??
        FALLBACK_FILE

    const openFiles = React.useMemo(
        () =>
            openFilePaths
                .map((path) => SAMPLE_REACT_PROJECT_FILES.find((file) => file.path === path))
                .filter((file): file is CodeFile => Boolean(file)),
        [openFilePaths]
    )

    const sharedExtensions = React.useMemo(() => getSharedEditorExtensions(), [])

    const editorExtensions = React.useMemo(
        () => [...sharedExtensions, getLanguageExtension(activeFile.language)],
        [activeFile.language, sharedExtensions]
    )

    const handleChange = (value: string) => {
        setFiles((previous) => ({
            ...previous,
            [activeFile.path]: value,
        }))

        if (activeFile.path === 'public/index.html') {
            onHtmlChange?.(value)
        }
    }

    const handleSelectFile = (path: CodeFilePath) => {
        setSelectedFile(path)
    }

    const handlePinFile = (path: CodeFilePath) => {
        setSelectedFile(path)
        setOpenFilePaths((previous) => (previous.includes(path) ? previous : [...previous, path]))
    }

    const handleCloseOpenFile = (path: CodeFilePath) => {
        setOpenFilePaths((previous) => {
            const closingIndex = previous.indexOf(path)
            if (closingIndex === -1) {
                return previous
            }

            const next = previous.filter((openPath) => openPath !== path)

            if (selectedFile === path) {
                const fallbackPath = next[closingIndex] ?? next[closingIndex - 1] ?? DEFAULT_CODE_FILE_PATH
                setSelectedFile(fallbackPath)
            }

            return next
        })
    }

    return (
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#1e1e1e] border-t border-[#2d2d2d]">
            <CodeWorkspaceFileSidebar
                tree={SAMPLE_REACT_PROJECT_TREE}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                onPinFile={handlePinFile}
            />

            <CodeWorkspaceEditorPane
                activeFile={activeFile}
                openFiles={openFiles}
                onSelectOpenFile={setSelectedFile}
                onCloseOpenFile={handleCloseOpenFile}
                value={files[activeFile.path] ?? ''}
                extensions={editorExtensions}
                onChange={handleChange}
            />
        </div>
    )
}
