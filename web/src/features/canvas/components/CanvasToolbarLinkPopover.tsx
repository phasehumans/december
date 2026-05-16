import { Globe, Check, X } from 'lucide-react'
import React from 'react'

interface CanvasToolbarLinkPopoverProps {
    isOpen: boolean
    linkUrl: string
    setLinkUrl: (value: string) => void
    onSubmit: () => void
    onClose: () => void
}

export const CanvasToolbarLinkPopover: React.FC<CanvasToolbarLinkPopoverProps> = ({
    isOpen,
    linkUrl,
    setLinkUrl,
    onSubmit,
    onClose,
}) => {
    if (!isOpen) {
        return null
    }

    return (
        <div className="bg-[#171615] border border-white/10 rounded-lg p-1.5 shadow-2xl flex items-center gap-2 pointer-events-auto min-w-[320px] animate-in fade-in slide-in-from-top-2 ring-1 ring-white/5">
            <div className="pl-3 pr-2 flex items-center justify-center text-neutral-400">
                <Globe size={14} />
            </div>
            <input
                autoFocus
                type="url"
                placeholder="Enter website URL..."
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
                className="flex-1 bg-transparent border-none text-xs text-[#E8E8E6] placeholder-neutral-500 focus:outline-none focus:ring-0 h-8"
            />
            <button
                onClick={onSubmit}
                className="w-7 h-7 flex items-center justify-center bg-white text-black rounded-md hover:bg-neutral-200 transition-colors shrink-0"
            >
                <Check size={14} strokeWidth={2.5} />
            </button>
            <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    )
}
