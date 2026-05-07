import React from 'react'

import { PromptPlaceholder } from '@/shared/components/ui/PromptPlaceholder'

interface PromptInputPlaceholderProps {
    shouldShow: boolean
    displayText: string
}

export const PromptInputPlaceholder: React.FC<PromptInputPlaceholderProps> = ({
    shouldShow,
    displayText,
}) => {
    if (!shouldShow) {
        return null
    }

    return (
        <>
            <div className="hidden md:block">
                <PromptPlaceholder displayText={displayText} />
            </div>
            <div className="md:hidden absolute left-5 top-[18px] text-[#6C6A69] pointer-events-none select-none truncate max-w-[calc(100%-60px)] text-[15px] font-medium">
                Ask December to create...
            </div>
        </>
    )
}
