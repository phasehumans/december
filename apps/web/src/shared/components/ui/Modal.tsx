import React from 'react'
import { createPortal } from 'react-dom'

import { BottomSheet, SheetHeader } from './BottomSheet'
import { Icons } from './Icons'

import { useBackToClose } from '@/shared/lib/useBackToClose'
import { useIsPhone } from '@/shared/lib/useIsPhone'

/** true inside a dialog that is shown as a bottom sheet, so its buttons can go full width */
export const ModalSheetContext = React.createContext(false)

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    maxWidth?: string
    variant?: 'default' | 'premium'
    showLogo?: boolean
    banner?: React.ReactNode
    /** phones show this dialog as a bottom sheet. desktop keeps the centered dialog */
    sheetOnPhone?: boolean
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = 'max-w-[480px]',
    variant = 'default',
    showLogo = true,
    banner,
    sheetOnPhone = false,
}) => {
    const isPhone = useIsPhone()
    const asSheet = sheetOnPhone && isPhone
    // back button and back swipe close the modal instead of leaving the page. the bottom
    // sheet does this itself
    useBackToClose({ isOpen: isOpen && !asSheet, onClose })

    if (!isOpen) return null

    if (asSheet) {
        return (
            <ModalSheetContext.Provider value={true}>
                <BottomSheet
                    isOpen
                    onClose={onClose}
                    ariaLabel={title}
                    header={<SheetHeader title={title} />}
                    avoidKeyboard
                >
                    <div className="flex flex-col gap-3 px-1 pt-0.5 pb-1.5">
                        {description && (
                            <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                                {description}
                            </p>
                        )}
                        {children}
                    </div>
                </BottomSheet>
            </ModalSheetContext.Provider>
        )
    }

    if (variant === 'premium') {
        const premiumMaxWidth = maxWidth === 'max-w-[480px]' ? 'max-w-[360px]' : maxWidth
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-none"
                    onClick={onClose}
                />
                <div
                    className={`relative group w-full ${premiumMaxWidth} bg-[#1E1E1E] border border-[#272727] rounded-[20px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
                >
                    <button
                        onClick={onClose}
                        className={
                            banner
                                ? 'absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-neutral-300 hover:text-white transition-all duration-200 focus:outline-none z-20 backdrop-blur-sm cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                                : 'absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors focus:outline-none z-10 cursor-pointer'
                        }
                    >
                        <Icons.X
                            className={banner ? 'w-4 h-4 stroke-[1.5]' : 'w-4.5 h-4.5 stroke-[1.5]'}
                        />
                    </button>

                    {banner}

                    <div className="p-6 sm:py-6.5 sm:px-6">
                        <div className="flex flex-col mb-4.5">
                            {showLogo && (
                                <div className="mb-3.5 select-none inline-block text-[#D6D5D4]">
                                    <Icons.DecemberLogo className="w-8 h-8" />
                                </div>
                            )}
                            <h2 className="text-[18px] font-medium text-white tracking-tight leading-tight mb-1.5">
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
            </div>,
            document.body
        )
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-none" onClick={onClose} />
            <div
                className={`relative w-full ${maxWidth} bg-[#1E1E1E] border border-[#272727] rounded-xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95 duration-200`}
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
        </div>,
        document.body
    )
}
