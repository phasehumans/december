import React from 'react'
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
    return (
        <div className="flex items-center justify-between px-3 pb-3 mt-1 pl-3">
            <div className="flex items-center gap-3">
                <button
                    onClick={onUpload}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-700 text-[#D5D4D3] hover:text-white hover:border-neutral-500 hover:bg-white/5 transition-all"
                    title="Add attachment"
                >
                    <Icons.Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={onSubmit}
                    disabled={!hasInput || isLoading}
                    className={`
                        flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ease-out
                        ${
                            hasInput && !isLoading
                                ? 'bg-[#B2B1B1] text-black hover:scale-110'
                                : 'bg-[#2C2C2E] text-neutral-500 cursor-not-allowed'
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
