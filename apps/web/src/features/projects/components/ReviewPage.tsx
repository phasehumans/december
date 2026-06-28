import React, { useState } from 'react'
import { GitPullRequest, ChevronDown, RefreshCw, User, ArrowRight, Plus } from 'lucide-react'

interface ReviewPageProps {
    onNewProject: () => void
}

export const ReviewPage: React.FC<ReviewPageProps> = ({ onNewProject }) => {
    const [topUrl, setTopUrl] = useState('')
    const [prUrl, setPrUrl] = useState('')

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            {/* Top Bar Navigation / Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-16 bg-[#141414] border border-[#2B2A29] rounded-xl px-5 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 text-[13px] font-medium text-[#D6D5C9] hover:bg-[#191919] px-3.5 py-1.5 rounded-lg border border-[#383736] transition-colors">
                        All repositories
                        <ChevronDown className="w-3.5 h-3.5 text-[#7B7A79]" />
                    </button>
                    <button
                        className="p-1.5 rounded-lg border border-[#383736] bg-[#191919] text-[#7B7A79] hover:text-[#D6D5C9] transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 min-w-[280px] max-w-xl relative">
                    <input
                        type="text"
                        placeholder="gitlab.com/org/repo/-/merge_requests/1"
                        value={topUrl}
                        onChange={(e) => setTopUrl(e.target.value)}
                        className="w-full rounded-lg border border-[#383736] bg-[#191919] py-1.5 pl-4 pr-4 text-[13px] text-[#D6D5C9] transition-colors placeholder:text-[#7B7A79] hover:bg-[#242323] focus:border-[#7B7A79] focus:bg-[#191919] focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-4 py-1.5 rounded-lg border border-[#383736] bg-[#191919] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors shrink-0">
                        Go to pull request
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-[#191919] border border-[#383736] flex items-center justify-center text-[#7B7A79] hover:text-[#D6D5C9] cursor-pointer transition-colors">
                        <User className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Main Center Content */}
            <div className="flex flex-col items-center justify-center min-h-[420px] max-w-2xl mx-auto text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#383736] flex items-center justify-center mb-6 shadow-2xl">
                    <GitPullRequest className="w-7 h-7 text-[#D6D5C9]" />
                </div>

                <h2 className="text-[22px] font-medium text-[#D6D5C9] mb-2">Review any PR URL</h2>
                <p className="text-[13px] text-[#7B7A79] mb-8 max-w-md leading-relaxed">
                    Paste a pull request URL from GitHub or GitLab to let december analyze, review,
                    and suggest improvements.
                </p>

                <div className="w-full relative mb-8">
                    <input
                        type="text"
                        placeholder="https://github.com/owner/repo/pull/123"
                        value={prUrl}
                        onChange={(e) => setPrUrl(e.target.value)}
                        className="w-full rounded-xl border border-[#383736] bg-[#141414] py-3.5 pl-5 pr-12 text-[14px] text-[#D6D5C9] transition-colors placeholder:text-[#7B7A79] hover:bg-[#191919] focus:border-[#7B7A79] focus:bg-[#191919] focus:outline-none shadow-2xl"
                    />
                    <button className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#242323] border border-[#383736] flex items-center justify-center text-[#D6D5C9] hover:bg-[#2B2A29] transition-colors">
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center w-full my-8">
                    <div className="flex-1 border-t border-[#2B2A29]"></div>
                    <span className="px-4 text-[12px] font-medium text-[#7B7A79]">or</span>
                    <div className="flex-1 border-t border-[#2B2A29]"></div>
                </div>

                <button
                    onClick={onNewProject}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-[#383736] bg-[#141414] text-[14px] font-medium text-[#D6D5C9] hover:bg-[#191919] hover:border-[#4A4948] transition-all shadow-xl"
                >
                    <Plus className="w-4 h-4" />
                    Create a PR with december
                </button>
            </div>
        </div>
    )
}
