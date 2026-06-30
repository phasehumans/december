import React, { useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { ProfileFeedbackModal } from '@/features/profile/components/ProfileFeedbackModal'
import { Icons } from '@/shared/components/ui/Icons'

interface HomeHeaderProps {
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ isAuthenticated, onOpenAuth }) => {
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

    return (
        <div className="absolute top-4 left-0 w-full px-4 md:px-6 z-50 flex justify-between items-start pointer-events-none">
            {/* Empty left spacer to truly center the middle element */}
            <div className="flex-1" />

            {/* Center Heading */}
            <div className="flex-initial flex justify-center pointer-events-auto"></div>

            {/* Right Icons */}
            <div className="flex-1 flex flex-col items-end gap-1 pointer-events-auto">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            if (isAuthenticated) {
                                setIsFeedbackModalOpen(true)
                            } else if (onOpenAuth) {
                                onOpenAuth()
                            }
                        }}
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1 cursor-pointer outline-none relative group/feedback"
                    >
                        <MessageSquare className="w-[17px] h-[17px]" strokeWidth={2} />
                        <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/feedback:flex items-center gap-1.5 bg-[#1C1B1A] border border-[#2A2928] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">Feedback</span>
                        </div>
                    </button>
                    <a
                        href="https://x.com/phasehumans"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                    >
                        <Icons.XLogo className="w-[15px] h-[15px]" />
                    </a>
                    <a
                        href="https://github.com/phasehumans/december"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1"
                    >
                        <Icons.Github className="w-5 h-5" />
                    </a>
                </div>
            </div>

            <ProfileFeedbackModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
            />
        </div>
    )
}
