import { MessageSquare, ArrowUpRight } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ProfileFeedbackModal } from '@/features/profile/components/ProfileFeedbackModal'
import { Icons } from '@/shared/components/ui/Icons'

interface HomeHeaderProps {
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ isAuthenticated, onOpenAuth }) => {
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="absolute top-4 left-0 w-full px-4 md:px-6 z-50 flex justify-between items-start pointer-events-none">
            <div className="flex-1 pointer-events-auto flex justify-start pl-2 md:pl-0">
                <a
                    href={import.meta.env?.VITE_DOCS_URL || 'http://localhost:3005'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#8F8E8D] hover:text-[#D4D4D8] transition-colors text-[12px] font-medium underline underline-offset-4 decoration-[#8F8E8D]/40 hover:decoration-[#D4D4D8] relative group/docs"
                >
                    Docs <ArrowUpRight className="w-3 h-3" />
                    <div className="absolute top-[calc(100%+6px)] left-0 z-50 hidden group-hover/docs:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                            Documentation
                        </span>
                    </div>
                </a>
            </div>

            {/* Center Heading */}
            <div className="flex-initial flex justify-center pointer-events-auto">
                <div
                    onClick={() => {
                        window.dispatchEvent(new Event('open-cli-card'))
                    }}
                    className="home-header-badge flex items-center gap-2.5 bg-transparent border border-white/5 rounded-full pl-1.5 pr-3 py-1 text-[13px] text-[#E8E8E6] shadow-sm transition-all duration-200 cursor-pointer hover:bg-white/5 group whitespace-nowrap flex-shrink-0"
                >
                    <span className="bg-[#87B2F4]/15 text-[#87B2F4] rounded-full px-2 py-1 text-[10px] font-medium leading-none flex items-center justify-center flex-shrink-0">
                        New
                    </span>
                    <span className="font-medium text-[#D4D4D8] group-hover:text-white transition-colors whitespace-nowrap">
                        December CLI is now available
                    </span>
                    <span className="text-[#3F3F46] font-light mx-0.5 flex-shrink-0">|</span>
                    <div className="text-[#D4D4D8] font-medium flex items-center gap-1 group-hover:text-white transition-colors whitespace-nowrap flex-shrink-0">
                        Try December CLI <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>

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
                        <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/feedback:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">Feedback</span>
                        </div>
                    </button>
                    <a
                        href="https://x.com/phasehumans"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1 relative group/twitter"
                    >
                        <Icons.XLogo className="w-[15px] h-[15px]" />
                        <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/twitter:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">Twitter</span>
                        </div>
                    </a>
                    <a
                        href="https://github.com/phasehumans/december"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-textMuted hover:text-textMain transition-colors flex items-center justify-center p-1 relative group/github"
                    >
                        <Icons.Github className="w-5 h-5" />
                        <div className="absolute top-[calc(100%+6px)] right-0 z-50 hidden group-hover/github:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">GitHub</span>
                        </div>
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
