import React from 'react'
import { CheckCircle2, Pen } from 'lucide-react'

interface ChatMessageEditedFilesProps {
    isVisible: boolean
}

const EDITED_FILES = ['src/App.tsx', 'src/components/TodoList.tsx', 'src/styles/globals.css']

export const ChatMessageEditedFiles: React.FC<ChatMessageEditedFilesProps> = ({ isVisible }) => {
    if (!isVisible) {
        return null
    }

    return (
        <div className="mt-2 mb-3 pl-1">
            <div className="flex items-center gap-2 text-[#91908F] mb-1.5">
                <Pen size={10} />
                <span className="text-[11px] font-medium">Edited 3 files</span>
            </div>
            <div className="bg-[#1C1C1C] border border-white/5 rounded-lg overflow-hidden w-full max-w-md">
                {EDITED_FILES.map((filePath, index) => {
                    const hasDivider = index < EDITED_FILES.length - 1

                    return (
                        <div
                            key={filePath}
                            className={`flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors group/file cursor-default ${
                                hasDivider ? 'border-b border-white/5' : ''
                            }`}
                        >
                            <span className="text-[11px] text-[#D4D4D8] font-mono opacity-80 group-hover/file:opacity-100 transition-opacity truncate">
                                {filePath}
                            </span>
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0 ml-2" />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
