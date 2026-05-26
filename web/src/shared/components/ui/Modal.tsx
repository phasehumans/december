import React from 'react'

import { Icons } from './Icons'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    maxWidth?: string
    variant?: 'default' | 'premium'
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = 'max-w-[480px]',
    variant = 'default',
}) => {
    if (!isOpen) return null

    if (variant === 'premium') {
        const premiumMaxWidth = maxWidth === 'max-w-[480px]' ? 'max-w-[400px]' : maxWidth
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
                <div
                    className={`relative w-full ${premiumMaxWidth} bg-[#121211] border border-white/5 rounded-[20px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors focus:outline-none z-10"
                    >
                        <Icons.X className="w-4.5 h-4.5 stroke-[1.5]" />
                    </button>

                    <div className="p-6">
                        <div className="flex flex-col mb-4">
                            <div className="mb-3 select-none inline-block text-[#D6D5D4]">
                                <Icons.DecemberLogo className="w-8 h-8" />
                            </div>
                            <h2 className="text-[18px] font-semibold text-white tracking-tight leading-tight mb-1">
                                {title}
                            </h2>
                            {description && (
                                <p className="text-[13px] text-[#8F8E8D] leading-relaxed font-normal">
                                    {description}
                                </p>
                            )}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className={`relative w-full ${maxWidth} bg-[#171615] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
            >
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-medium text-white mb-1">{title}</h2>
                            {description && (
                                <p className="text-sm text-neutral-400">{description}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-neutral-500 hover:text-white transition-colors"
                        >
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}
