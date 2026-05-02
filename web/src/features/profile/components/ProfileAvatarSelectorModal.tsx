import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

interface ProfileAvatarSelectorModalProps {
    isOpen: boolean
    onClose: () => void
    currentAvatar: string
    onSelectAvatar: (seed: string) => void
}

const AVATAR_SEEDS = [
    'Felix',
    'Jocelyn',
    'Avery',
    'Liliana',
    'Leo',
    'Mia',
    'Nolan',
    'Sara',
    'Jack',
    'Emma',
    'Oliver',
    'Sophia',
]

export const ProfileAvatarSelectorModal: React.FC<ProfileAvatarSelectorModalProps> = ({
    isOpen,
    onClose,
    currentAvatar,
    onSelectAvatar,
}) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const [selected, setSelected] = useState(currentAvatar)

    useEffect(() => {
        if (isOpen) {
            setSelected(currentAvatar)
        }
    }, [isOpen, currentAvatar])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'
            const mainScroll = document.getElementById('main-scroll-container')
            if (mainScroll) mainScroll.style.overflow = 'hidden'
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'unset'
            const mainScroll = document.getElementById('main-scroll-container')
            if (mainScroll) mainScroll.style.overflow = 'auto'
        }
    }, [isOpen, onClose])

    if (!isOpen || typeof document === 'undefined') return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const handleSave = () => {
        onSelectAvatar(selected)
        onClose()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-[480px] bg-[#171615] border border-[#242323] rounded-[20px] shadow-2xl relative p-6 flex flex-col mx-4 animate-in zoom-in-95 duration-200"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[20px] font-medium text-[#D6D5C9]">Choose an avatar</h2>
                    <button
                        className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-8">
                    {AVATAR_SEEDS.map((seed) => (
                        <button
                            key={seed}
                            onClick={() => setSelected(seed)}
                            className={`relative aspect-square rounded-full border-[3px] transition-all overflow-hidden ${
                                selected === seed
                                    ? 'border-[#D6D5C9] scale-105 shadow-[0_0_15px_rgba(214,213,201,0.15)] bg-[#1E1D1B]'
                                    : 'border-[#2B2A29] bg-[#100E12] hover:border-[#4A4948] hover:bg-[#1E1D1B] hover:scale-105'
                            }`}
                        >
                            <img
                                src={`https://api.dicebear.com/7.x/micah/svg?seed=${seed}&backgroundColor=transparent`}
                                alt={`Avatar ${seed}`}
                                className="w-full h-full object-cover p-1"
                            />
                            {selected === seed && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                    <div className="w-7 h-7 bg-[#D6D5C9] rounded-full flex items-center justify-center shadow-xl">
                                        <Check className="w-4 h-4 text-[#171615]" strokeWidth={3} />
                                    </div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-end gap-3 mt-auto">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl border border-[#383736] text-[13.5px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13.5px] font-medium hover:bg-white transition-colors"
                    >
                        Save changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
