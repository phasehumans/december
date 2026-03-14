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

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ html, onHtmlChange }) => {
    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>(DEFAULT_CODE_FILE_PATH)
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
        SAMPLE_REACT_PROJECT_FILES[0] ?? {
            path: DEFAULT_CODE_FILE_PATH,
            label: 'App.tsx',
            language: 'tsx',
        }

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

    return (
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#1e1e1e] border-t border-[#2d2d2d]">
            <CodeWorkspaceFileSidebar
                tree={SAMPLE_REACT_PROJECT_TREE}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
            />

            <CodeWorkspaceEditorPane
                activeFile={activeFile}
                value={files[activeFile.path] ?? ''}
                extensions={editorExtensions}
                onChange={handleChange}
            />
        </div>
    )
}
