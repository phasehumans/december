import { ChevronLeft } from 'lucide-react'
import React from 'react'

interface DocsPageProps {
    onBack?: () => void
}

export const DocsPage: React.FC<DocsPageProps> = ({ onBack }) => {
    return (
        <div className="flex w-full h-full bg-[#100E12] overflow-hidden p-1.5 md:p-[8px] font-sans">
            <div className="flex w-full h-full bg-[#171615] rounded-lg border border-[#242323] overflow-y-auto lg:overflow-hidden relative">
                {/* Minimal Back Button */}
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute top-5 left-5 flex items-center justify-center text-[#8F8E8D] hover:text-white transition-colors z-20 cursor-pointer"
                        title="Go back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}

                <div className="flex w-full h-full p-6 md:p-10 pt-16 md:pt-20 lg:pt-[80px] gap-8 lg:gap-12 flex-col lg:flex-row max-w-[1300px] mx-auto items-start">
                    {/* No content inside */}
                </div>
            </div>
        </div>
    )
}
