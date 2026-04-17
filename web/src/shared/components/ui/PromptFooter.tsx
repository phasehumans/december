import React, { useState } from 'react'

import { Icons } from './Icons'

interface PromptFooterProps {
    onUpload: () => void
    onSubmit: () => void
    hasInput: boolean
    isLoading: boolean
}

export const PromptFooter: React.FC<PromptFooterProps> = ({
    onUpload,
    onSubmit,
    hasInput,
    isLoading,
}) => {
    const [isMicActive, setIsMicActive] = useState(false)

    return (
        <div className="flex items-center justify-between px-3 pb-3 mt-1 pl-3">
            <div className="flex items-center gap-3">
                <button
                    onClick={onUpload}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-[#727272] transition-all hover:bg-white/5 hover:text-white"
                    title="Add attachment"
                >
                    <Icons.Plus className="w-[18px] h-[18px] stroke-[2.5px]" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setIsMicActive(!isMicActive)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                        isMicActive
                            ? 'bg-white/10 text-white'
                            : 'text-[#727272] hover:bg-white/5 hover:text-white'
                    }`}
                    title="Voice input"
                >
                    <Icons.Microphone className="w-[18px] h-[18px] stroke-[2.5px]" />
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!hasInput || isLoading}
                    className={`
                        flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200
                        ${
                            hasInput && !isLoading
                                ? 'bg-[#D6D5D4] text-black'
                                : 'bg-[#2C2C2E] text-[#4A4A4A] cursor-not-allowed'
                        }
                    `}
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-neutral-500 border-t-neutral-800 rounded-full animate-spin" />
                    ) : (
                        <Icons.ArrowUp className="w-4 h-4 stroke-[3px]" />
                    )}
                </button>
            </div>
        </div>
    )
}
