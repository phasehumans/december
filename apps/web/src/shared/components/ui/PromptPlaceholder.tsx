import React from 'react'

interface PromptPlaceholderProps {
    displayText: string
}

export const PromptPlaceholder: React.FC<PromptPlaceholderProps> = ({ displayText }) => {
    return (
        <div
            className="absolute top-0 left-0 w-full h-full pointer-events-none 
            pt-[18px] pl-5 pr-12 text-[15px] font-sans font-medium leading-relaxed flex items-start select-none overflow-hidden text-[#949494]"
        >
            <span className="whitespace-pre">Ask December to create </span>
            <span className="text-[#949494] transition-opacity duration-200">{displayText}</span>
        </div>
    )
}
