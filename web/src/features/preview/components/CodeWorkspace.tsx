import React from 'react'
import { CodeWorkspaceEditorPane } from './CodeWorkspaceEditorPane'
import { CodeWorkspaceFileSidebar } from './CodeWorkspaceFileSidebar'
import {
    DEFAULT_CODE_FILE_PATH,
    SAMPLE_REACT_PROJECT_FILES,
    SAMPLE_REACT_PROJECT_TREE,
    createCodeWorkspaceTree,
    flattenFiles,
    getDefaultCodeFilePath,
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

const getWorkspaceHtmlPath = (paths: CodeFilePath[]) => {
    const preferredPaths = ['web/index.html', 'public/index.html', 'index.html']

    return preferredPaths.find((path) => paths.includes(path)) ?? null
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
    html,
    generatedFiles,
    activeFilePath,
    onHtmlChange,
}) => {
    const hasGeneratedFiles = Boolean(generatedFiles && Object.keys(generatedFiles).length > 0)

    const generatedFileContents = React.useMemo(
        () =>
            hasGeneratedFiles
                ? Object.fromEntries(
                      Object.entries(generatedFiles ?? {}).map(([path, file]) => [path, file.content])
                  )
                : null,
        [generatedFiles, hasGeneratedFiles]
    )

    const workspaceTree = React.useMemo(
        () =>
            hasGeneratedFiles && generatedFiles
                ? createCodeWorkspaceTree(Object.keys(generatedFiles))
                : SAMPLE_REACT_PROJECT_TREE,
        [generatedFiles, hasGeneratedFiles]
    )

    const workspaceFiles = React.useMemo(
        () => (hasGeneratedFiles ? flattenFiles(workspaceTree) : SAMPLE_REACT_PROJECT_FILES),
        [hasGeneratedFiles, workspaceTree]
    )

    const defaultFilePath = React.useMemo(
        () =>
            hasGeneratedFiles
                ? getDefaultCodeFilePath(workspaceFiles.map((file) => file.path))
                : DEFAULT_CODE_FILE_PATH,
        [hasGeneratedFiles, workspaceFiles]
    )

    const htmlFilePath = React.useMemo(
        () => getWorkspaceHtmlPath(workspaceFiles.map((file) => file.path)),
        [workspaceFiles]
    )

    const [selectedFile, setSelectedFile] = React.useState<CodeFilePath>(defaultFilePath)
    const [openFilePaths, setOpenFilePaths] = React.useState<CodeFilePath[]>([defaultFilePath])
    const [files, setFiles] = React.useState<Record<CodeFilePath, string>>(() =>
        hasGeneratedFiles && generatedFileContents ? generatedFileContents : getSampleReactProjectContents(html)
    )

    React.useEffect(() => {
        if (hasGeneratedFiles && generatedFileContents) {
            setFiles(generatedFileContents)
            return
        }

        setFiles(getSampleReactProjectContents(html))
    }, [generatedFileContents, hasGeneratedFiles, html])

    React.useEffect(() => {
        if (activeFilePath && workspaceFiles.some((file) => file.path === activeFilePath)) {
            setSelectedFile(activeFilePath)
            setOpenFilePaths((previous) =>
                previous.includes(activeFilePath) ? previous : [...previous, activeFilePath]
            )
            return
        }

        if (!workspaceFiles.some((file) => file.path === selectedFile)) {
            setSelectedFile(defaultFilePath)
            setOpenFilePaths([defaultFilePath])
        }
    }, [activeFilePath, defaultFilePath, selectedFile, workspaceFiles])

    React.useEffect(() => {
        if (!htmlFilePath) {
            return
        }

        setFiles((previous) => {
            if (!previous[htmlFilePath] || previous[htmlFilePath] === html) {
                return {
                    ...previous,
                    [htmlFilePath]: html,
                }
            }

            return previous
        })
    }, [html, htmlFilePath])

    const activeFile: CodeFile =
        workspaceFiles.find((file) => file.path === selectedFile) ?? workspaceFiles[0] ?? FALLBACK_FILE

    const openFiles = React.useMemo(
        () =>
            openFilePaths
                .map((path) => workspaceFiles.find((file) => file.path === path))
                .filter((file): file is CodeFile => Boolean(file)),
        [openFilePaths, workspaceFiles]
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

        if (htmlFilePath && activeFile.path === htmlFilePath) {
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
                const fallbackPath = next[closingIndex] ?? next[closingIndex - 1] ?? defaultFilePath
                setSelectedFile(fallbackPath)
            }

            return next
        })
    }

    return (
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#1e1e1e] border-t border-[#2d2d2d]">
            <CodeWorkspaceFileSidebar
                tree={workspaceTree}
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
