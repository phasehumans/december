import CodeMirror from '@uiw/react-codemirror'
import React from 'react'

import { codeMirrorBasicSetup } from './codeWorkspaceConfig'
import { CodeWorkspaceEditorHeader } from './CodeWorkspaceEditorHeader'

import type { CodeFile, CodeFilePath } from '@/features/preview/types'
import type { Extension } from '@codemirror/state'

interface CodeWorkspaceEditorPaneProps {
    activeFile: CodeFile | null
    openFiles: CodeFile[]
    onSelectOpenFile: (path: CodeFilePath) => void
    onCloseOpenFile: (path: CodeFilePath) => void
    value: string
    extensions: Extension[]
    onChange: (value: string) => void
    wordWrap: boolean
    toggleWordWrap: () => void
    cursorPos: { line: number; col: number }
    onCursorPosChange: (pos: { line: number; col: number }) => void
    onFormatCode: (value: string) => void
}

const getLanguageLabel = (language: string | undefined): string => {
    if (!language) return 'Plain Text'
    const maps: Record<string, string> = {
        html: 'HTML',
        css: 'CSS',
        typescript: 'TypeScript',
        tsx: 'TypeScript JSX',
        javascript: 'JavaScript',
        jsx: 'JavaScript JSX',
    }
    return maps[language.toLowerCase()] ?? language
}

export const CodeWorkspaceEditorPane: React.FC<CodeWorkspaceEditorPaneProps> = ({
    activeFile,
    openFiles,
    onSelectOpenFile,
    onCloseOpenFile,
    value,
    extensions,
    onChange,
    wordWrap,
    toggleWordWrap,
    cursorPos,
    onCursorPosChange,
    onFormatCode,
}) => {
    const activeLanguageLabel = React.useMemo(
        () => getLanguageLabel(activeFile?.language),
        [activeFile]
    )

    const activeFileLines = React.useMemo(() => value.split('\n').length, [value])
    const activeFileSize = React.useMemo(() => {
        const bytes = new Blob([value]).size
        if (bytes < 1024) return `${bytes} B`
        return `${(bytes / 1024).toFixed(1)} KB`
    }, [value])

    return (
        <div className="flex-1 min-w-0 min-h-0 bg-[#171615] flex flex-col justify-between">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <CodeWorkspaceEditorHeader
                    activeFile={activeFile}
                    openFiles={openFiles}
                    onSelectFile={onSelectOpenFile}
                    onCloseFile={onCloseOpenFile}
                    wordWrap={wordWrap}
                    toggleWordWrap={toggleWordWrap}
                    fileContent={value}
                    onFormatCode={onFormatCode}
                />

                <div className="flex-1 min-h-0">
                    {activeFile ? (
                        <CodeMirror
                            key={activeFile.path}
                            value={value}
                            height="100%"
                            className="h-full text-[14px]"
                            extensions={extensions}
                            basicSetup={codeMirrorBasicSetup}
                            onChange={onChange}
                            onUpdate={(update) => {
                                const state = update.state
                                const head = state.selection.main.head
                                const line = state.doc.lineAt(head)
                                onCursorPosChange({
                                    line: line.number,
                                    col: head - line.from + 1,
                                })
                            }}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-sm text-[#8b8b8b]">
                            Files will appear here as generation starts.
                        </div>
                    )}
                </div>
            </div>

            {activeFile && (
                <div className="h-6 bg-[#181817] border-t border-[#262626] text-[11px] text-[#858585] px-3.5 flex items-center justify-end font-sans select-none shrink-0">
                    <div className="flex items-center gap-5 font-medium">
                        <span>
                            Ln {cursorPos.line}, Col {cursorPos.col}
                        </span>
                        <span className="w-[1px] h-3 bg-[#2d2d2d]" />
                        <span>
                            {activeFileLines} lines ({activeFileSize})
                        </span>
                        <span className="w-[1px] h-3 bg-[#2d2d2d]" />
                        <span>Spaces: 2</span>
                        <span className="w-[1px] h-3 bg-[#2d2d2d]" />
                        <span>UTF-8</span>
                        <span className="w-[1px] h-3 bg-[#2d2d2d]" />
                        <span className="uppercase text-[#a3a3a3] font-semibold tracking-wide">
                            {activeLanguageLabel}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
