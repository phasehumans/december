import { ChevronLeft, Book, Code, Terminal, Zap } from 'lucide-react'
import React, { useState } from 'react'

interface DocsViewProps {
    onBack: () => void
}

export const DocsView: React.FC<DocsViewProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('Introduction')

    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px]">
            <div className="flex w-full h-full bg-[#141414] rounded-lg border border-[#242323] overflow-hidden">
                {/* Docs Sidebar */}
                <div className="w-[220px] shrink-0 border-r border-[#242323] flex flex-col py-4">
                    <div className="px-4 mb-6">
                        <button
                            onClick={onBack}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Home
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-[2px]">
                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1">
                            Getting Started
                        </div>
                        <button
                            onClick={() => setActiveTab('Introduction')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Introduction'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Book className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Introduction
                        </button>
                        <button
                            onClick={() => setActiveTab('Quick Start')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Quick Start'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Zap className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Quick Start
                        </button>

                        <div className="px-3 py-2 text-[12px] font-medium text-[#7B7A79] mt-4 mb-1">
                            Core Concepts
                        </div>
                        <button
                            onClick={() => setActiveTab('Architecture')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'Architecture'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Code className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            Architecture
                        </button>
                        <button
                            onClick={() => setActiveTab('CLI Reference')}
                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${
                                activeTab === 'CLI Reference'
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                            }`}
                        >
                            <Terminal className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            CLI Reference
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#141414] [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                    <div className="w-full flex justify-center px-8 md:px-16 py-8 md:py-12 relative z-10">
                        <div className="flex flex-col gap-6 w-full max-w-3xl">
                            <h1 className="text-[24px] font-medium text-[#D6D5C9]">{activeTab}</h1>
                            <p className="text-[14px] text-[#7B7A79] leading-relaxed">
                                Documentation content for {activeTab} will appear here.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
