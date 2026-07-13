import React, { useState } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface ReviewPageProps {
    onNewProject: () => void
}

export const ReviewPage: React.FC<ReviewPageProps> = () => {
    const [prUrl, setPrUrl] = useState('')

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto max-w-6xl">
                {/* Header matching Sessions page */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">Review</h1>
                        <p className="text-[13px] text-[#7B7A79]">
                            Review pull requests, collaborate on code, and merge changes seamlessly.
                        </p>
                    </div>
                </div>

                {/* Top Action Bar */}
                <div className="relative z-10 mb-12 flex w-full items-center">
                    {/* Left: URL Input and Button */}
                    <div className="flex items-center gap-3 w-full max-w-[480px]">
                        <div className="relative w-full">
                            <input
                                type="text"
                                placeholder="gitlab.com/org/repo/-/merge_requests/1"
                                className="w-full rounded-lg border border-[#383736] bg-[#141414] py-1.5 px-3.5 text-[13px] text-[#D6D5C9] transition-colors placeholder:text-[#555453] hover:bg-[#191919] focus:border-[#7B7A79] focus:bg-[#191919] focus:outline-none"
                            />
                        </div>
                        <button className="whitespace-nowrap px-4 py-1.5 rounded-lg border border-[#383736] bg-[#1A1918] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#262626] transition-colors">
                            Go to pull request
                        </button>
                    </div>

                    <div className="flex-1" />

                    {/* Right: Repository Dropdown */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button className="flex items-center gap-2 rounded-full border border-[#383736] bg-[#141414] px-4 py-1.5 text-[13px] text-[#D6D5C9] transition-colors hover:bg-[#191919]">
                                All repositories{' '}
                                <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Big Input Area */}
                <div className="flex w-full flex-col items-center justify-center mt-32 mb-20">
                    <div className="w-full max-w-[560px] flex flex-col">
                        <h2 className="text-[15px] font-medium text-[#D6D5C9] mb-3">
                            Review any PR URL
                        </h2>

                        <div className="relative w-full group">
                            <input
                                type="text"
                                value={prUrl}
                                onChange={(e) => setPrUrl(e.target.value)}
                                placeholder="https://github.com/owner/repo/pull/123"
                                className="w-full bg-[#141414] border border-[#383736] hover:border-[#4A4948] focus:border-[#7B7A79] focus:bg-[#191919] rounded-xl pl-4 pr-24 py-3.5 text-[14px] text-[#D6D5C9] placeholder:text-[#555453] transition-colors focus:outline-none shadow-sm"
                            />
                            <button
                                className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium transition-colors ${prUrl ? 'bg-[#1A1918] text-[#D6D5C9] hover:bg-[#262626]' : 'bg-[#141414] text-[#7B7A79]'}`}
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
