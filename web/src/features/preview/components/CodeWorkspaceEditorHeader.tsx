import React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceEditorHeaderProps {
    activeFile: CodeFile | null
    openFiles: CodeFile[]
    onSelectFile: (path: CodeFilePath) => void
    onCloseFile: (path: CodeFilePath) => void
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
}) => {
    const tabs = React.useMemo(() => getTabs(activeFile, openFiles), [activeFile, openFiles])

    return (
        <div className="h-10 shrink-0 border-b border-[#2d2d2d] bg-[#1e1e1e]">
            <div className="h-full px-2 flex items-center gap-1 overflow-x-auto">
                {tabs.length === 0 ? (
                    <span className="text-[12px] text-[#7a7a7a] px-2">No files yet</span>
                ) : (
                    tabs.map((tab) => {
                        const isActive = tab.file.path === activeFile?.path

                        return (
                            <div
                                key={`${tab.file.path}-${tab.isPreview ? 'preview' : 'pinned'}`}
                                className={cn(
                                    'h-7 min-w-0 max-w-[220px] flex items-center rounded-lg border px-2 gap-1.5',
                                    isActive
                                        ? 'bg-[#393F51] border-[#4a5166] text-[#d4d4d4]'
                                        : 'bg-[#1f1f1f] border-[#2d2d2d] text-[#a3a3a3] hover:bg-[#252526]'
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelectFile(tab.file.path)}
                                    className={cn(
                                        'min-w-0 truncate text-[12px] text-left',
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
                                        className="shrink-0 text-[#8b8b8b] hover:text-[#d4d4d4]"
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
        </div>
    )
}
