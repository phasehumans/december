import React from 'react'

interface CodeWorkspaceStatusBarProps {
    line: number
    column: number
    lines: number
    chars: number
}

export const CodeWorkspaceStatusBar: React.FC<CodeWorkspaceStatusBarProps> = ({
    line,
    column,
    lines,
    chars,
}) => {
    return (
        <div className="h-8 shrink-0 px-4 flex items-center justify-between text-[11px] border-t border-[#2d2d2d] bg-[#1e1e1e] text-[#858585]">
            <span>
                Ln {line}, Col {column}
            </span>
            <span>
                {lines} lines | {chars} chars
            </span>
        </div>
    )
}
