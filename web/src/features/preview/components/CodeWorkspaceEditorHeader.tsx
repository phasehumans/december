import React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceEditorHeaderProps {
    activeFile: CodeFile
    openFiles: CodeFile[]
    onSelectFile: (path: CodeFilePath) => void
    onCloseFile: (path: CodeFilePath) => void
}

interface HeaderTab {
    file: CodeFile
    isPreview: boolean
}

const getTabs = (activeFile: CodeFile, openFiles: CodeFile[]): HeaderTab[] => {
    const isActivePinned = openFiles.some((file) => file.path === activeFile.path)

    if (isActivePinned) {
        return openFiles.map((file) => ({ file, isPreview: false }))
    }

    return [...openFiles.map((file) => ({ file, isPreview: false })), { file: activeFile, isPreview: true }]
}

const getPathLabel = (path: string) => path.split('/').join(' / ')

export const CodeWorkspaceEditorHeader: React.FC<CodeWorkspaceEditorHeaderProps> = ({
    activeFile,
    openFiles,
    onSelectFile,
    onCloseFile,
}) => {
    const tabs = React.useMemo(() => getTabs(activeFile, openFiles), [activeFile, openFiles])

    return (
        <div className="shrink-0 border-b border-[#2d2d2d] bg-[#1e1e1e]">
            <div className="h-9 px-2 flex items-center gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = tab.file.path === activeFile.path

                    return (
                        <div
                            key={`${tab.file.path}-${tab.isPreview ? 'preview' : 'pinned'}`}
                            className={cn(
                                'h-7 min-w-0 max-w-[220px] flex items-center rounded border px-1.5 gap-1',
                                isActive
                                    ? 'bg-[#1f2937] border-[#374151] text-[#d4d4d4]'
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
                })}
            </div>

            <div className="h-6 px-3 border-t border-[#252526] text-[11px] text-[#8a8a8a] flex items-center truncate">
                {getPathLabel(activeFile.path)}
            </div>
        </div>
    )
}
