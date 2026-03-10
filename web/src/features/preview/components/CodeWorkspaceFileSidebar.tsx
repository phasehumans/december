import React from 'react'
import { FileText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceFileSidebarProps {
    files: CodeFile[]
    selectedFile: CodeFilePath
    onSelectFile: (path: CodeFilePath) => void
}

export const CodeWorkspaceFileSidebar: React.FC<CodeWorkspaceFileSidebarProps> = ({
    files,
    selectedFile,
    onSelectFile,
}) => {
    return (
        <aside className="w-56 shrink-0 border-r border-[#2d2d2d] bg-[#1e1e1e] flex flex-col">
            <div className="h-10 px-3 flex items-center justify-between border-b border-[#2d2d2d]">
                <span className="text-[11px] tracking-[0.1em] uppercase text-[#858585]">Explorer</span>
                <span className="text-[11px] text-[#858585]">{files.length}</span>
            </div>
            <div className="p-1.5 space-y-0.5 overflow-auto">
                {files.map((file) => {
                    const isActive = selectedFile === file.path

                    return (
                        <button
                            key={file.path}
                            onClick={() => onSelectFile(file.path)}
                            className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[13px] transition-colors',
                                isActive
                                    ? 'bg-[#2a2d2e] text-[#d4d4d4]'
                                    : 'text-[#c5c5c5] hover:bg-[#252526]'
                            )}
                        >
                            <FileText
                                size={14}
                                className={cn('shrink-0', isActive ? 'text-[#d4d4d4]' : 'text-[#858585]')}
                            />
                            <span className="truncate">{file.label}</span>
                        </button>
                    )
                })}
            </div>
        </aside>
    )
}
