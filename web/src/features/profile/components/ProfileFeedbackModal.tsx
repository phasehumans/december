import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Frown, Meh, Smile } from 'lucide-react'

interface ProfileFeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProfileFeedbackModal: React.FC<ProfileFeedbackModalProps> = ({ isOpen, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const [rating, setRating] = useState<'sad' | 'neutral' | 'happy' | null>(null)
    const [feedback, setFeedback] = useState('')

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

    const handleSubmit = () => {
        // Handle submission logic here
        onClose()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-[560px] bg-[#171615] border border-[#242323] rounded-[20px] shadow-2xl relative p-7 flex flex-col mx-4 animate-in zoom-in-95 duration-200"
            >
                <h2 className="text-[20px] font-medium text-[#D6D5C9] mb-3">Give feedback</h2>
                <p className="text-[14px] text-[#7B7A79] leading-relaxed mb-6 pr-4">
                    We'd love to hear what went well or how we can improve the product experience.
                </p>

                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full bg-[#100E12] border border-[#242323] rounded-xl p-4 text-[14px] text-[#D6D5C9] outline-none resize-none h-[130px] mb-6 focus:border-[#4A4948] transition-colors placeholder:text-[#4A4948]"
                    placeholder="Your feedback"
                />

                <div className="flex items-center justify-between mt-1">
                    {/* Ratings */}
                    <div className="flex gap-2.5">
                        <button
                            onClick={() => setRating('sad')}
                            className={`p-2.5 rounded-xl border transition-colors ${rating === 'sad' ? 'bg-[#242323] border-[#4A4948] text-[#D6D5C9]' : 'border-[#242323] bg-[#100E12] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'}`}
                        >
                            <Frown className="w-[18px] h-[18px]" strokeWidth={2} />
                        </button>
                        <button
                            onClick={() => setRating('neutral')}
                            className={`p-2.5 rounded-xl border transition-colors ${rating === 'neutral' ? 'bg-[#242323] border-[#4A4948] text-[#D6D5C9]' : 'border-[#242323] bg-[#100E12] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'}`}
                        >
                            <Meh className="w-[18px] h-[18px]" strokeWidth={2} />
                        </button>
                        <button
                            onClick={() => setRating('happy')}
                            className={`p-2.5 rounded-xl border transition-colors ${rating === 'happy' ? 'bg-[#242323] border-[#4A4948] text-[#D6D5C9]' : 'border-[#242323] bg-[#100E12] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'}`}
                        >
                            <Smile className="w-[18px] h-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl border border-[#383736] text-[13.5px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13.5px] font-medium hover:bg-white transition-colors"
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
