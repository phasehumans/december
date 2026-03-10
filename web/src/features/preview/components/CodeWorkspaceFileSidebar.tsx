import React from 'react'
import { Braces, FileCode2, Palette } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { CodeFile, CodeFilePath } from '@/features/preview/types'

interface CodeWorkspaceFileSidebarProps {
    files: CodeFile[]
    selectedFile: CodeFilePath
    onSelectFile: (path: CodeFilePath) => void
}

const getFileVisuals = (file: CodeFile) => {
    if (file.language === 'html') {
        return {
            Icon: FileCode2,
            accent: '#E4A95F',
            badge: 'HTML',
        }
    }

    if (file.language === 'css') {
        return {
            Icon: Palette,
            accent: '#8DB5F2',
            badge: 'CSS',
        }
    }

    return {
        Icon: Braces,
        accent: '#94C79C',
        badge: 'JS',
    }
}

export const CodeWorkspaceFileSidebar: React.FC<CodeWorkspaceFileSidebarProps> = ({
    files,
    selectedFile,
    onSelectFile,
}) => {
    return (
        <aside className="w-64 shrink-0 border-r border-[#303030] bg-[#1F1F1F] flex flex-col">
            <div className="h-11 px-4 flex items-center justify-between border-b border-[#303030]">
                <span className="text-[11px] tracking-[0.12em] uppercase text-[#9B9B9B]">Explorer</span>
                <span className="text-[10px] text-[#787878]">{files.length} files</span>
            </div>
            <div className="p-2 space-y-1 overflow-auto">
                {files.map((file) => {
                    const { Icon, accent, badge } = getFileVisuals(file)
                    const isActive = selectedFile === file.path

                    return (
                        <button
                            key={file.path}
                            onClick={() => onSelectFile(file.path)}
                            className={cn(
                                'group relative w-full flex items-center gap-2 px-2.5 py-2.5 rounded-md text-left text-sm transition-colors border',
                                isActive
                                    ? 'bg-[#2A2A2A] text-[#E6E6E6] border-[#3A3A3A]'
                                    : 'text-[#A7A7A7] border-transparent hover:text-[#E6E6E6] hover:bg-[#262626]'
                            )}
                        >
                            <span
                                className={cn(
                                    'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r transition-opacity',
                                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'
                                )}
                                style={{ backgroundColor: accent }}
                            />
                            <Icon size={14} className="shrink-0" style={{ color: accent }} />
                            <span className="truncate flex-1">{file.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222222] text-[#9B9B9B] border border-[#303030]">
                                {badge}
                            </span>
                        </button>
                    )
                })}
            </div>
        </aside>
    )
}
