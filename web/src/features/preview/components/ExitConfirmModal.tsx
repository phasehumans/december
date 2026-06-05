import { AlertTriangle, X } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'

interface ExitConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#171615] border border-[#242323] rounded-2xl w-full max-w-[480px] overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 border-b border-[#242323] flex flex-col gap-2 pr-12">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h2 className="text-xl font-medium text-[#D6D5C9]">Exit Project?</h2>
                    </div>
                    <p className="text-sm text-[#7B7A79]">
                        Are you sure you want to exit? Your current generation and the preview
                        container will stop.
                    </p>
                </div>

                <div className="p-6 bg-[#100E12]/30 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-[#D6D5C9] hover:bg-[#242323] text-[14px] font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onClose()
                            onConfirm()
                        }}
                        className="px-5 py-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 text-[14px] font-medium transition-all"
                    >
                        Yes, Exit
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
