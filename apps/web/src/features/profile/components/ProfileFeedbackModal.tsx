import { Frown, Meh, Smile } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { profileAPI } from '@/features/profile/api/profile'
import { Modal } from '@/shared/components/ui/Modal'

interface ProfileFeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProfileFeedbackModal: React.FC<ProfileFeedbackModalProps> = ({ isOpen, onClose }) => {
    const [rating, setRating] = useState<'sad' | 'neutral' | 'happy' | null>(null)
    const [feedback, setFeedback] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showThankYou, setShowThankYou] = useState(false)

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('feedback-modal-open')
        } else {
            document.body.classList.remove('feedback-modal-open')
        }
        return () => {
            document.body.classList.remove('feedback-modal-open')
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!feedback.trim() && !rating) return

        setIsSubmitting(true)
        try {
            await profileAPI.submitFeedback({ rating, feedback: feedback.trim() })
        } catch {
            setIsSubmitting(false)
            return
        }
        setIsSubmitting(false)
        setShowThankYou(true)

        // Show thank you message for 2.2 seconds, then close modal
        setTimeout(() => {
            onClose()
            // Reset state after transition finishes
            setTimeout(() => {
                setFeedback('')
                setRating(null)
                setShowThankYou(false)
            }, 200)
        }, 2200)
    }

    const handleClose = () => {
        if (!isSubmitting) {
            onClose()
            // Reset state in case they close it
            setFeedback('')
            setRating(null)
            setShowThankYou(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={showThankYou ? 'Thank you!' : 'Give feedback'}
            description={
                showThankYou
                    ? 'Your feedback helps us make december better for everyone.'
                    : "We'd love to hear what went well or how we can improve the product experience."
            }
            variant="premium"
        >
            {showThankYou ? (
                <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#D6D5C9] mb-3 shadow-lg shadow-black/20">
                        <Smile className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                        We appreciate you taking the time to share your thoughts.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full bg-[#181817] border border-[#2B2A27] hover:border-[#383736] focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] rounded-lg p-3.5 text-[13px] text-white outline-none resize-none h-[110px] transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                        placeholder="Your feedback..."
                        disabled={isSubmitting}
                    />

                    <div className="flex items-center justify-between mt-1">
                        {/* Ratings */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setRating('sad')}
                                disabled={isSubmitting}
                                className={`p-2 rounded-lg border transition-[transform,background-color,border-color,color,box-shadow] duration-200 ${
                                    rating === 'sad'
                                        ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm'
                                        : 'border-[#2B2A27] bg-[#181817]/50 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'
                                } disabled:opacity-50`}
                            >
                                <Frown className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setRating('neutral')}
                                disabled={isSubmitting}
                                className={`p-2 rounded-lg border transition-[transform,background-color,border-color,color,box-shadow] duration-200 ${
                                    rating === 'neutral'
                                        ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm'
                                        : 'border-[#2B2A27] bg-[#181817]/50 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'
                                } disabled:opacity-50`}
                            >
                                <Meh className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setRating('happy')}
                                disabled={isSubmitting}
                                className={`p-2 rounded-lg border transition-[transform,background-color,border-color,color,box-shadow] duration-200 ${
                                    rating === 'happy'
                                        ? 'bg-[#242323] border-[#7B7A79] text-white scale-105 shadow-sm'
                                        : 'border-[#2B2A27] bg-[#181817]/50 text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9]'
                                } disabled:opacity-50`}
                            >
                                <Smile className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || (!feedback.trim() && !rating)}
                                className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[90px]"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-1.5 justify-center">
                                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                        <span>Submitting...</span>
                                    </div>
                                ) : (
                                    'Submit'
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </Modal>
    )
}
