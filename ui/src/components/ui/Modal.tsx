import React from 'react'
import { Icons } from './Icons'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    maxWidth?: string
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = 'max-w-[480px]',
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className={`relative w-full ${maxWidth} bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
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
