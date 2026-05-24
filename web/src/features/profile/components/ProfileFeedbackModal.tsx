import { Frown, Meh, Smile, Loader2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ProfileFeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProfileFeedbackModal: React.FC<ProfileFeedbackModalProps> = ({ isOpen, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const [rating, setRating] = useState<'sad' | 'neutral' | 'happy' | null>(null)
    const [feedback, setFeedback] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showThankYou, setShowThankYou] = useState(false)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose()
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
    }, [isOpen, onClose, isSubmitting])

    if (!isOpen || typeof document === 'undefined') return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isSubmitting) {
            onClose()
        }
    }

    const handleSubmit = async () => {
        if (!feedback.trim() && !rating) return

        setIsSubmitting(true)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setIsSubmitting(false)
        setShowThankYou(true)

        // Show thank you message for 2 seconds, then close modal
        setTimeout(() => {
            onClose()
            // Reset state after transition finishes
            setTimeout(() => {
                setFeedback('')
                setRating(null)
                setShowThankYou(false)
            }, 200)
        }, 2000)
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            {showThankYou ? (
                <div
                    ref={modalRef}
                    className="w-full max-w-[500px] bg-[#171615] border border-[#242323] rounded-[20px] shadow-2xl relative p-10 flex flex-col items-center justify-center text-center mx-4 animate-in zoom-in-95 duration-200 min-h-[300px]"
                >
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#D6D5C9] mb-5 shadow-lg shadow-black/20">
                        <Smile className="w-6 h-6 text-[#D6D5C9]" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-[20px] font-medium text-[#D6D5C9] mb-2 tracking-tight">
                        Thank you!
                    </h2>
                    <p className="text-[13.5px] text-[#7B7A79] leading-relaxed max-w-[340px]">
                        Your feedback helps us make december better for everyone.
                    </p>
                </div>
            ) : (
                <div
                    ref={modalRef}
                    className="w-full max-w-[500px] bg-[#171615] border border-[#242323] rounded-[20px] shadow-2xl relative p-7 flex flex-col mx-4 animate-in zoom-in-95 duration-200"
                >
                    <h2 className="text-[18px] font-semibold text-[#D6D5C9] mb-2.5 tracking-tight">
                        Give feedback
                    </h2>
                    <p className="text-[13px] text-[#7B7A79] leading-relaxed mb-5 pr-4">
                        We'd love to hear what went well or how we can improve the product
                        experience.
                    </p>

                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full bg-[#100E12]/40 border border-[#242323] hover:border-[#383736] focus:border-[#7B7A79] rounded-xl p-4 text-[13.5px] text-[#D6D5C9] outline-none resize-none h-[130px] mb-5 transition-all duration-300 placeholder:text-[#4A4948]"
                        placeholder="Your feedback..."
                        disabled={isSubmitting}
                    />

                    <div className="flex items-center justify-between mt-1">
                        {/* Ratings */}
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setRating('sad')}
                                disabled={isSubmitting}
                                className={`p-2.5 rounded-xl border transition-all duration-200 ${rating === 'sad' ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm' : 'border-[#242323] bg-[#100E12]/20 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Frown className="w-[18px] h-[18px]" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setRating('neutral')}
                                disabled={isSubmitting}
                                className={`p-2.5 rounded-xl border transition-all duration-200 ${rating === 'neutral' ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm' : 'border-[#242323] bg-[#100E12]/20 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Meh className="w-[18px] h-[18px]" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setRating('happy')}
                                disabled={isSubmitting}
                                className={`p-2.5 rounded-xl border transition-all duration-200 ${rating === 'happy' ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm' : 'border-[#242323] bg-[#100E12]/20 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Smile className="w-[18px] h-[18px]" strokeWidth={1.8} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 rounded-xl border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting || (!feedback.trim() && !rating)}
                                className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13px] font-semibold hover:bg-white transition-colors flex items-center justify-center min-w-[80px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-[#171615]" />
                                ) : (
                                    'Submit'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    )
}
