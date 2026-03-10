import React from 'react'
import type { CodeFile } from '@/features/preview/types'

interface CodeWorkspaceEditorHeaderProps {
    activeFile: CodeFile
}

const getLanguageLabel = (language: CodeFile['language']) => {
    if (language === 'html') {
        return 'HTML'
    }

    if (language === 'css') {
        return 'CSS'
    }

    return 'JavaScript'
}

export const CodeWorkspaceEditorHeader: React.FC<CodeWorkspaceEditorHeaderProps> = ({ activeFile }) => {
    return (
        <div className="h-11 shrink-0 px-4 flex items-center justify-between text-xs border-b border-[#2d2d2d] bg-[#1e1e1e]">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#d4d4d4] truncate">{activeFile.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252525] text-[#858585] border border-[#2d2d2d]">
                    {getLanguageLabel(activeFile.language)}
                </span>
            </div>
            <div className="text-[11px] text-[#8A8A8A]">Auto-sync preview</div>
        </div>
    )
}
