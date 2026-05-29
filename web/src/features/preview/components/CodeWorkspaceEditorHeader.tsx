import { X, Copy, Check, Braces } from 'lucide-react'
import React from 'react'

import type { CodeFile, CodeFilePath } from '@/features/preview/types'

import { cn } from '@/shared/lib/utils'

interface CodeWorkspaceEditorHeaderProps {
    activeFile: CodeFile | null
    openFiles: CodeFile[]
    onSelectFile: (path: CodeFilePath) => void
    onCloseFile: (path: CodeFilePath) => void
    wordWrap: boolean
    toggleWordWrap: () => void
    fileContent: string
    onFormatCode: (value: string) => void
}

interface HeaderTab {
    file: CodeFile
    isPreview: boolean
}

const getTabs = (activeFile: CodeFile | null, openFiles: CodeFile[]): HeaderTab[] => {
    if (!activeFile) {
        return openFiles.map((file) => ({ file, isPreview: false }))
    }

    const isActivePinned = openFiles.some((file) => file.path === activeFile.path)

    if (isActivePinned) {
        return openFiles.map((file) => ({ file, isPreview: false }))
    }

    return [
        ...openFiles.map((file) => ({ file, isPreview: false })),
        { file: activeFile, isPreview: true },
    ]
}

export const CodeWorkspaceEditorHeader: React.FC<CodeWorkspaceEditorHeaderProps> = ({
    activeFile,
    openFiles,
    onSelectFile,
    onCloseFile,
    wordWrap,
    toggleWordWrap,
    fileContent,
    onFormatCode,
}) => {
    const tabs = React.useMemo(() => getTabs(activeFile, openFiles), [activeFile, openFiles])
    const [isCopied, setIsCopied] = React.useState(false)
    const [isFormatted, setIsFormatted] = React.useState(false)

    const handleCopy = () => {
        if (!fileContent) return
        navigator.clipboard.writeText(fileContent)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    const handleFormat = () => {
        if (!fileContent) return
        const formatted =
            fileContent
                .split('\n')
                .map((line) => line.trimEnd())
                .join('\n')
                .trim() + '\n'
        onFormatCode(formatted)
        setIsFormatted(true)
        setTimeout(() => setIsFormatted(false), 2000)
    }

    return (
        <div className="h-10 shrink-0 border-b border-[#2d2d2d] bg-[#171615] flex items-center justify-between px-3">
            <div className="flex-1 h-full flex items-center gap-1 overflow-x-auto no-scrollbar">
                {tabs.length === 0 ? (
                    <span className="text-[12px] text-[#7a7a7a] px-2">No files yet</span>
                ) : (
                    tabs.map((tab) => {
                        const isActive = tab.file.path === activeFile?.path

                        return (
                            <div
                                key={`${tab.file.path}-${tab.isPreview ? 'preview' : 'pinned'}`}
                                className={cn(
                                    'h-7 min-w-0 max-w-[220px] flex items-center rounded-lg border px-2 gap-1.5 shrink-0',
                                    isActive
                                        ? 'bg-[#393F51] border-[#4a5166] text-[#d4d4d4]'
                                        : 'bg-[#1f1f1f] border-[#2d2d2d] text-[#a3a3a3] hover:bg-[#252526]'
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelectFile(tab.file.path)}
                                    className={cn(
                                        'min-w-0 truncate text-[12px] text-left outline-none',
                                        tab.isPreview && 'italic'
                                    )}
                                >
                                    {tab.file.label}
                                </button>

                                {!tab.isPreview && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onCloseFile(tab.file.path)
                                        }}
                                        className="shrink-0 text-[#8b8b8b] hover:text-[#d4d4d4] outline-none"
                                        aria-label={`Close ${tab.file.label}`}
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {activeFile && (
                <div className="flex items-center gap-2 ml-4 shrink-0 text-[#858585]">
                    <button
                        type="button"
                        onClick={handleFormat}
                        className="p-1.5 hover:bg-white/5 hover:text-white rounded transition-colors flex items-center gap-1.5 outline-none min-w-[32px] justify-center"
                        title="Format Code (Prettier)"
                    >
                        {isFormatted ? (
                            <>
                                <Check
                                    size={14}
                                    className="text-amber-500 animate-in zoom-in-75 duration-200"
                                />
                                <span className="text-[10px] text-amber-500 font-medium font-sans">
                                    Formatted!
                                </span>
                            </>
                        ) : (
                            <Braces size={14} />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-white/5 hover:text-white rounded transition-colors flex items-center gap-1.5 outline-none min-w-[32px] justify-center"
                        title="Copy Code"
                    >
                        {isCopied ? (
                            <>
                                <Check
                                    size={14}
                                    className="text-green-500 animate-in zoom-in-75 duration-200"
                                />
                                <span className="text-[10px] text-green-500 font-medium font-sans">
                                    Copied!
                                </span>
                            </>
                        ) : (
                            <Copy size={14} />
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
